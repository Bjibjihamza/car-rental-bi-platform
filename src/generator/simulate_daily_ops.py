# src/generator/simulate_daily_ops.py
# -------------------------------------------------------------------
# Simulate daily in-branch ops for RAW layer:
# - Clients  (insert)
# - Reservations (Confirmed)
# - Rentals  (Active)
# - Payments (initial payment)
#
# Per branch per day: 1..3 clients (configurable).
# Skips cleanly if no car 'Disponible' in the branch.
# Uses your existing RAW connection module:
#   from src.database.connexion.raw_db import raw_db
# -------------------------------------------------------------------

import os
import uuid
import random
import string
import argparse
import datetime as dt
from typing import Optional, Tuple, List

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# RAW Oracle client (per your repo structure)
from src.database.connexion.raw_db import raw_db

# --------------------------- Utilities ---------------------------

FIRST_NAMES = [
    "Omar","Sara","Youssef","Leila","Hassan","Rania","Hamza","Mariam",
    "Rachid","Fatima","Anas","Salma","Aya","Younes","Khalid","Nadia",
    "Othmane","Kenza"
]
LAST_NAMES  = [
    "Raji","Kettani","Bennani","Pasha","Mansouri","Fassi","Cherkaoui",
    "Zouaki","Kadiri","Hadji","Oumari","El Idrissi","El Amrani",
    "El Yazidi","Lahlou"
]

PAY_METHODS  = ["Cash","Credit Card","Debit Card","Bank Transfer","Mobile Payment"]

def rand_name() -> Tuple[str,str]:
    return random.choice(FIRST_NAMES), random.choice(LAST_NAMES)

def rand_phone() -> str:
    # Morocco-like: +2126xxxxxxxx
    return "+2126" + "".join(random.choice(string.digits) for _ in range(8))

def rand_email(first: str, last: str) -> str:
    tag = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    return f"{first.lower()}.{last.lower()}.{tag}@example.ma"

def rand_license() -> str:
    # Synthetic driver license
    return "DL-" + "".join(random.choice(string.ascii_uppercase + string.digits) for _ in range(10))

def random_datetime(start: dt.datetime, end: dt.datetime) -> dt.datetime:
    delta = end - start
    sec = random.randint(0, int(delta.total_seconds()))
    return start + dt.timedelta(seconds=sec)

# --------------------------- SQL ---------------------------

SQL_BRANCHES = """
SELECT branch_id, branch_name, city
FROM Branches
ORDER BY branch_id
"""

SQL_MANAGERS_BY_BRANCH = """
SELECT manager_id
FROM Managers
WHERE branch_id = :bid
ORDER BY manager_id
"""

SQL_PICK_AVAILABLE_CAR = """
/* pick one 'Disponible' car from the branch; get effective daily_rate
   (prefer car.daily_rate if set, else category.daily_rate) */
SELECT c.car_id,
       c.mileage,
       COALESCE(c.daily_rate, cc.daily_rate) AS eff_daily_rate
FROM Cars c
JOIN Car_Categories cc ON cc.category_id = c.category_id
WHERE c.branch_id = :bid
  AND c.status = 'Disponible'
ORDER BY c.car_id
FETCH FIRST 1 ROWS ONLY
"""

SQL_INSERT_CLIENT = """
INSERT INTO Clients (
  first_name, last_name, email, phone, address, city, country,
  driver_license, license_expiry_date, date_of_birth, registration_date,
  total_rentals, average_rating, created_at, updated_at
) VALUES (
  :first_name, :last_name, :email, :phone, :address, :city, :country,
  :driver_license, :license_expiry_date, :date_of_birth, :registration_date,
  0, NULL, SYSTIMESTAMP, SYSTIMESTAMP
)
RETURNING client_id INTO :out_id
"""

SQL_INSERT_RESERVATION = """
INSERT INTO Reservations (
  client_id, car_id, branch_pickup_id, branch_return_id,
  reservation_date, pickup_date, return_date, total_amount, status
) VALUES (
  :client_id, :car_id, :pickup_bid, :return_bid,
  :reservation_date, :pickup_date, :return_date, :total_amount, :status
)
RETURNING reservation_id INTO :out_id
"""

SQL_INSERT_RENTAL = """
INSERT INTO Rentals (
  reservation_id, client_id, car_id, manager_id,
  pickup_date, expected_return_date, actual_return_date,
  pickup_mileage, return_mileage, daily_rate, total_amount, deposit_amount,
  status, payment_status, distance_driven_km, fuel_used_l, rental_rating,
  state_before, state_after, created_at, updated_at
) VALUES (
  :reservation_id, :client_id, :car_id, :manager_id,
  :pickup_date, :expected_return_date, NULL,
  :pickup_mileage, NULL, :daily_rate, :total_amount, :deposit_amount,
  'Active', :payment_status, NULL, NULL, NULL,
  NULL, NULL, SYSTIMESTAMP, SYSTIMESTAMP
)
RETURNING rental_id INTO :out_id
"""

SQL_UPDATE_CAR_STATUS = """
UPDATE Cars
SET status = 'Loué'
WHERE car_id = :car_id
"""

SQL_INSERT_PAYMENT = """
INSERT INTO Payments (
  rental_id, payment_date, amount, payment_method, transaction_id, status
) VALUES (
  :rental_id, :payment_date, :amount, :payment_method, :transaction_id, :status
)
"""

# --------------------------- Core Logic ---------------------------

def simulate_for_day(
    target_day: dt.date,
    min_per_branch: int,
    max_per_branch: int,
    verbose: bool = True
) -> None:
    """For each branch, create N clients (1..3 by default) that reserve & rent a car.
       If no 'Disponible' car in the branch, skip gracefully."""
    pickup_start = dt.datetime.combine(target_day, dt.time(9, 0))   # 09:00
    pickup_end   = dt.datetime.combine(target_day, dt.time(18, 0))  # 18:00

    # Fetch branches
    with raw_db.cursor() as cur:
        cur.execute(SQL_BRANCHES)
        branches = cur.fetchall()  # [(branch_id, branch_name, city), ...]

    total_created = 0

    for bid, bname, bcity in branches:
        n_clients = random.randint(min_per_branch, max_per_branch)
        created_here = 0

        # Pick a manager (optional)
        with raw_db.cursor() as cur:
            cur.execute(SQL_MANAGERS_BY_BRANCH, [bid])
            managers = [row[0] for row in cur.fetchall()]
        manager_id: Optional[int] = random.choice(managers) if managers else None

        for _ in range(n_clients):
            # Pick a 'Disponible' car
            with raw_db.cursor() as cur:
                cur.execute(SQL_PICK_AVAILABLE_CAR, [bid])
                row = cur.fetchone()

            if not row:
                if verbose:
                    print(f"[{bname}] No 'Disponible' car — skipping client.")
                continue

            car_id, pickup_mileage, eff_daily_rate = row

            # Rental window (1..7 days) within the day
            pickup_dt = random_datetime(pickup_start, pickup_end)
            rental_days = random.randint(1, 7)
            return_dt = pickup_dt + dt.timedelta(days=rental_days)

            # Amounts
            daily_rate = float(eff_daily_rate or 0.0)
            total_amount = round(daily_rate * rental_days, 2)
            deposit_amount = round(total_amount * 0.2, 2) if total_amount > 0 else 0.0

            # Synthetic client
            first, last = rand_name()
            email = rand_email(first, last)
            phone = rand_phone()
            driver_license = rand_license()
            dob = dt.date(1980, 1, 1) + dt.timedelta(days=random.randint(0, 40*365))
            lic_exp = dt.date.today() + dt.timedelta(days=random.randint(365, 365*10))  # 1–10 years

            # Payment status choice (most Completed)
            pay_status = random.choices(["Completed","Pending"], weights=[0.75, 0.25], k=1)[0]
            pay_method = random.choice(PAY_METHODS)

            try:
                with raw_db.cursor() as cur:
                    # 1) Client
                    out_client = cur.var(int)
                    cur.execute(SQL_INSERT_CLIENT, dict(
                        first_name=first, last_name=last, email=email, phone=phone,
                        address=f"{random.randint(1,250)} Rue Exemple",
                        city=bcity or "N/A",
                        country="Morocco",
                        driver_license=driver_license,
                        license_expiry_date=lic_exp,
                        date_of_birth=dob,
                        registration_date=target_day,
                        out_id=out_client
                    ))
                    client_id = int(out_client.getvalue()[0])  # <<— IMPORTANT: index [0]

                    # 2) Reservation (Confirmed)
                    out_res = cur.var(int)
                    cur.execute(SQL_INSERT_RESERVATION, dict(
                        client_id=client_id,
                        car_id=car_id,
                        pickup_bid=bid,
                        return_bid=bid,  # same-branch return (simple)
                        reservation_date=pickup_dt - dt.timedelta(hours=1),
                        pickup_date=pickup_dt,
                        return_date=return_dt,
                        total_amount=total_amount,
                        status="Confirmed",
                        out_id=out_res
                    ))
                    reservation_id = int(out_res.getvalue()[0])

                    # 3) Rental (Active)
                    out_rent = cur.var(int)
                    cur.execute(SQL_INSERT_RENTAL, dict(
                        reservation_id=reservation_id,
                        client_id=client_id,
                        car_id=car_id,
                        manager_id=manager_id,
                        pickup_date=pickup_dt,
                        expected_return_date=return_dt,
                        pickup_mileage=int(pickup_mileage or 0),
                        daily_rate=daily_rate,
                        total_amount=total_amount,
                        deposit_amount=deposit_amount,
                        payment_status=pay_status,
                        out_id=out_rent
                    ))
                    rental_id = int(out_rent.getvalue()[0])

                    # 4) Update car status -> 'Loué'
                    cur.execute(SQL_UPDATE_CAR_STATUS, dict(car_id=car_id))

                    # 5) Payment
                    cur.execute(SQL_INSERT_PAYMENT, dict(
                        rental_id=rental_id,
                        payment_date=pickup_dt,
                        amount=total_amount,
                        payment_method=pay_method,
                        transaction_id=str(uuid.uuid4()),
                        status=pay_status
                    ))

                created_here += 1
                total_created += 1

                if verbose:
                    print(
                        f"[{bname}] OK client={client_id} car={car_id} rental={rental_id} "
                        f"{pickup_dt:%Y-%m-%d %H:%M} → {return_dt:%Y-%m-%d %H:%M} "
                        f"amount={total_amount}"
                    )

            except Exception as e:
                # If a trigger/constraint fails (overlap, etc.), skip this client gracefully
                if verbose:
                    print(f"[{bname}] ⚠️ client skipped ({type(e).__name__}): {e}")

        if verbose:
            print(f"[{bname}] Created today: {created_here}")

    if verbose:
        print(f"Total created (all branches): {total_created}")

# --------------------------- CLI ---------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Simulate daily branch operations: Clients, Reservations, Rentals, Payments (RAW)"
    )
    parser.add_argument(
        "--date", type=str, default=dt.date.today().isoformat(),
        help="Day to simulate (YYYY-MM-DD). Default: today"
    )
    parser.add_argument(
        "--min-per-branch", type=int, default=1,
        help="Min clients per branch per day (default 1)"
    )
    parser.add_argument(
        "--max-per-branch", type=int, default=3,
        help="Max clients per branch per day (default 3)"
    )
    parser.add_argument(
        "--days", type=int, default=1,
        help="Number of consecutive days to simulate (default 1)"
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Verbose logs"
    )
    args = parser.parse_args()

    base_day = dt.date.fromisoformat(args.date)

    for d in range(args.days):
        day = base_day + dt.timedelta(days=d)
        if args.verbose:
            print(f"\n=== Simulation for {day.isoformat()} ===")
        simulate_for_day(day, args.min_per_branch, args.max_per_branch, verbose=args.verbose)

if __name__ == "__main__":
    main()

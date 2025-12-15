import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { Link, useNavigate } from "react-router-dom";

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

type CarRow = {
  CAR_ID: number;
  MAKE: string;
  MODEL: string;
  LICENSE_PLATE: string;
  STATUS: string;
};

type CustomerRow = {
  CUSTOMER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  NATIONAL_ID: string;
  DRIVER_LICENSE_NO: string;
  DATE_OF_BIRTH: string;
  EMAIL?: string | null;
  PHONE?: string | null;
};

export function RentalsCreatePage() {
  const { token, user } = useAuth();
  const nav = useNavigate();

  const isManager = String(user?.role || "").toLowerCase() === "manager";

  const [cars, setCars] = useState<CarRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [CAR_ID, setCarId] = useState<number | "">("");
  const [CUSTOMER_ID, setCustomerId] = useState<number | "">("");
  const [START_AT, setStartAt] = useState("");
  const [DUE_AT, setDueAt] = useState("");
  const [TOTAL_AMOUNT, setTotalAmount] = useState<string>("");
  const [CURRENCY, setCurrency] = useState("MAD");

  // Quick add customer
  const [newFn, setNewFn] = useState("");
  const [newLn, setNewLn] = useState("");
  const [newCin, setNewCin] = useState("");
  const [newDob, setNewDob] = useState(""); // YYYY-MM-DD
  const [newLic, setNewLic] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [err, setErr] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [carsRes, custRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/cars`, { headers }),
        fetch(`${API_URL}/api/v1/customers`, { headers }),
      ]);

      const carsData = await carsRes.json();
      const custData = await custRes.json();

      if (!carsRes.ok) throw new Error(carsData?.message || "Failed to load cars");
      if (!custRes.ok) throw new Error(custData?.message || "Failed to load customers");

      setCars(Array.isArray(carsData) ? carsData : []);
      setCustomers(Array.isArray(custData) ? custData : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCars = useMemo(
    () => cars.filter((c) => String(c.STATUS).toUpperCase() === "AVAILABLE"),
    [cars]
  );

  async function quickAddCustomer() {
    setErr(null);
    try {
      if (!isManager) {
        setErr("Only managers can add customers");
        return;
      }

      if (!newFn.trim() || !newLn.trim() || !newCin.trim() || !newDob.trim() || !newLic.trim()) {
        setErr("First/Last name, CIN, DOB, and License are required");
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          FIRST_NAME: newFn.trim(),
          LAST_NAME: newLn.trim(),
          NATIONAL_ID: newCin.trim(),
          DATE_OF_BIRTH: newDob.trim(),
          DRIVER_LICENSE_NO: newLic.trim(),
          EMAIL: newEmail ? newEmail.trim() : null,
          PHONE: newPhone ? newPhone.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create customer");

      await load();
      setCustomerId(Number(data.CUSTOMER_ID));

      setNewFn("");
      setNewLn("");
      setNewCin("");
      setNewDob("");
      setNewLic("");
      setNewEmail("");
      setNewPhone("");
    } catch (e: any) {
      setErr(e?.message || "Failed to create customer");
    }
  }

  async function createRental() {
    setErr(null);
    try {
      if (!isManager) {
        setErr("Only managers can create rentals");
        return;
      }

      if (!CAR_ID || !CUSTOMER_ID || !START_AT || !DUE_AT) {
        setErr("Please fill Car, Customer, Start, Due");
        return;
      }

      const payload = {
        CAR_ID,
        CUSTOMER_ID,
        START_AT: new Date(START_AT).toISOString(),
        DUE_AT: new Date(DUE_AT).toISOString(),
        TOTAL_AMOUNT: TOTAL_AMOUNT ? Number(TOTAL_AMOUNT) : null,
        CURRENCY,
        STATUS: "ACTIVE",
      };

      const res = await fetch(`${API_URL}/api/v1/rentals`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create rental");

      nav(`/rentals/${data.RENTAL_ID}/report`);
    } catch (e: any) {
      setErr(e?.message || "Failed to create rental");
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card
        title="Create rental"
        subtitle={isManager ? "Assign a car to a customer" : "Managers only (view-only)"}
        right={
          <Link to="/rentals" className="text-sm text-neutral-300 hover:underline">
            Back
          </Link>
        }
      >
        {err && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {!isManager && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            You are logged in as <b>{user?.role}</b>. Only <b>MANAGER</b> can create rentals or customers.
          </div>
        )}

        {loading ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* LEFT */}
            <div className="space-y-3">
              <div>
                <div className="text-xs text-neutral-400 mb-1">Car (AVAILABLE)</div>
                <select
                  value={CAR_ID}
                  onChange={(e) => setCarId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                  disabled={!isManager}
                >
                  <option value="">Select a car…</option>
                  {availableCars.map((c) => (
                    <option key={c.CAR_ID} value={c.CAR_ID}>
                      {c.MAKE} {c.MODEL} — {c.LICENSE_PLATE}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-neutral-400 mb-1">Customer</div>
                <select
                  value={CUSTOMER_ID}
                  onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                  disabled={!isManager}
                >
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.CUSTOMER_ID} value={c.CUSTOMER_ID}>
                      {c.FIRST_NAME} {c.LAST_NAME} — {c.NATIONAL_ID}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Start</div>
                  <input
                    type="datetime-local"
                    value={START_AT}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                    disabled={!isManager}
                  />
                </div>
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Due</div>
                  <input
                    type="datetime-local"
                    value={DUE_AT}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                    disabled={!isManager}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Total amount</div>
                  <input
                    value={TOTAL_AMOUNT}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="e.g. 1200"
                    className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                    disabled={!isManager}
                  />
                </div>
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Currency</div>
                  <select
                    value={CURRENCY}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                    disabled={!isManager}
                  >
                    <option value="MAD">MAD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <button
                onClick={createRental}
                className={`h-10 rounded-lg px-4 text-sm font-bold text-white ${
                  isManager ? "bg-indigo-600 hover:bg-indigo-500" : "bg-white/10 cursor-not-allowed"
                }`}
                disabled={!isManager}
              >
                Create rental
              </button>
            </div>

            {/* RIGHT */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-bold text-white">Quick add customer</div>

              {!isManager && (
                <div className="text-xs text-neutral-400">
                  Disabled for <b>SUPERVISOR</b>.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newFn}
                  onChange={(e) => setNewFn(e.target.value)}
                  placeholder="First name *"
                  className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                  disabled={!isManager}
                />
                <input
                  value={newLn}
                  onChange={(e) => setNewLn(e.target.value)}
                  placeholder="Last name *"
                  className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                  disabled={!isManager}
                />
              </div>

              <input
                value={newCin}
                onChange={(e) => setNewCin(e.target.value)}
                placeholder="CIN (NATIONAL_ID) *"
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                disabled={!isManager}
              />

              <input
                type="date"
                value={newDob}
                onChange={(e) => setNewDob(e.target.value)}
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                disabled={!isManager}
              />

              <input
                value={newLic}
                onChange={(e) => setNewLic(e.target.value)}
                placeholder="Driver license *"
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                disabled={!isManager}
              />

              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email (optional)"
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                disabled={!isManager}
              />

              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
                disabled={!isManager}
              />

              <button
                onClick={quickAddCustomer}
                className={`h-10 rounded-lg border border-white/10 px-4 text-sm font-bold text-white ${
                  isManager ? "bg-white/10 hover:bg-white/15" : "bg-white/5 cursor-not-allowed"
                }`}
                disabled={!isManager}
              >
                Add customer
              </button>

              <div className="text-xs text-neutral-400">
                After adding, customer is auto-selected.
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

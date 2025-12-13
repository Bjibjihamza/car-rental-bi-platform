// src/frontend/src/pages/Rentals.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

type RentalRow = {
  RENTAL_ID: number;
  CAR_ID: number;
  CUSTOMER_ID: number;
  BRANCH_ID: number;
  MANAGER_ID: number | null;

  START_AT: string;
  DUE_AT: string;
  RETURN_AT: string | null;
  STATUS: "ACTIVE" | "IN_PROGRESS" | "CLOSED" | "CANCELLED" | string;

  START_ODOMETER: number | null;
  END_ODOMETER: number | null;
  TOTAL_AMOUNT: number | null;
  CURRENCY: string | null;
  CREATED_AT: string;

  BRANCH_CITY?: string | null;

  LICENSE_PLATE?: string | null;
  MAKE?: string | null;
  MODEL?: string | null;

  CUSTOMER_FIRST_NAME?: string | null;
  CUSTOMER_LAST_NAME?: string | null;
};

type CarOption = { CAR_ID: number; LICENSE_PLATE: string; MAKE: string; MODEL: string; BRANCH_ID: number | null };
type CustomerOption = { CUSTOMER_ID: number; FIRST_NAME: string; LAST_NAME: string; EMAIL?: string | null };
type BranchOption = { BRANCH_ID: number; BRANCH_NAME: string; CITY: string };

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function money(amount: number | null, cur: string | null) {
  if (amount == null) return "—";
  return `${amount.toFixed(2)} ${cur ?? ""}`.trim();
}

function badgeClass(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (s === "IN_PROGRESS") return "bg-blue-500/15 text-blue-300 border-blue-500/25";
  if (s === "CLOSED") return "bg-slate-500/15 text-slate-200 border-slate-500/25";
  if (s === "CANCELLED") return "bg-red-500/15 text-red-300 border-red-500/25";
  return "bg-amber-500/15 text-amber-300 border-amber-500/25";
}

export function RentalsPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  const [rows, setRows] = useState<RentalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const [selected, setSelected] = useState<RentalRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [cars, setCars] = useState<CarOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [form, setForm] = useState({
    CAR_ID: "" as any,
    CUSTOMER_ID: "" as any,
    BRANCH_ID: "" as any, // supervisor only
    START_AT: "",
    DUE_AT: "",
    STATUS: "ACTIVE",
    START_ODOMETER: "" as any,
    TOTAL_AMOUNT: "" as any,
    CURRENCY: "MAD",
  });

  async function fetchRentals() {
    if (!user) return;
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/rentals`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load rentals");
    } finally {
      setLoading(false);
    }
  }

  // For create modal: we’ll reuse existing endpoints (cars/customers/branches)
  async function fetchCars() {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/v1/cars`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) {
      // only cars that are AVAILABLE (optional)
      setCars(
        data
          .filter((c: any) => String(c.STATUS).toUpperCase() === "AVAILABLE")
          .map((c: any) => ({
            CAR_ID: c.CAR_ID,
            LICENSE_PLATE: c.LICENSE_PLATE,
            MAKE: c.MAKE,
            MODEL: c.MODEL,
            BRANCH_ID: c.BRANCH_ID ?? null,
          }))
      );
    }
  }

  async function fetchCustomers() {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/v1/customers`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) {
      setCustomers(
        data.map((c: any) => ({
          CUSTOMER_ID: c.CUSTOMER_ID,
          FIRST_NAME: c.FIRST_NAME,
          LAST_NAME: c.LAST_NAME,
          EMAIL: c.EMAIL ?? null,
        }))
      );
    }
  }

  async function fetchBranches() {
    if (!user || !isSup) return;
    const res = await fetch(`${API_URL}/api/v1/branches`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) {
      setBranches(
        data.map((b: any) => ({
          BRANCH_ID: b.BRANCH_ID,
          BRANCH_NAME: b.BRANCH_NAME,
          CITY: b.CITY,
        }))
      );
    }
  }

  async function createRental() {
    if (!user) return;

    setCreating(true);
    try {
      const payload: any = {
        CAR_ID: Number(form.CAR_ID),
        CUSTOMER_ID: Number(form.CUSTOMER_ID),
        START_AT: form.START_AT,
        DUE_AT: form.DUE_AT,
        STATUS: form.STATUS,
        START_ODOMETER: form.START_ODOMETER === "" ? null : Number(form.START_ODOMETER),
        TOTAL_AMOUNT: form.TOTAL_AMOUNT === "" ? null : Number(form.TOTAL_AMOUNT),
        CURRENCY: form.CURRENCY,
      };

      if (isSup) payload.BRANCH_ID = Number(form.BRANCH_ID);

      const res = await fetch(`${API_URL}/api/v1/rentals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setCreateOpen(false);
      setForm({
        CAR_ID: "" as any,
        CUSTOMER_ID: "" as any,
        BRANCH_ID: "" as any,
        START_AT: "",
        DUE_AT: "",
        STATUS: "ACTIVE",
        START_ODOMETER: "" as any,
        TOTAL_AMOUNT: "" as any,
        CURRENCY: "MAD",
      });

      await fetchRentals();
    } catch (e: any) {
      alert(e?.message || "Failed to create rental");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    fetchRentals();
    // preload for modal
    fetchCars();
    fetchCustomers();
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.branchId]);

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => String(r.STATUS).toUpperCase()))),
    [rows]
  );

  const filtered = useMemo(() => {
    let base = rows.slice();
    const qq = q.trim().toLowerCase();

    if (status !== "ALL") base = base.filter((r) => String(r.STATUS).toUpperCase() === status);

    if (qq) {
      base = base.filter((r) =>
        [
          r.RENTAL_ID,
          r.LICENSE_PLATE,
          r.MAKE,
          r.MODEL,
          r.BRANCH_CITY,
          r.CUSTOMER_FIRST_NAME,
          r.CUSTOMER_LAST_NAME,
          r.STATUS,
        ]
          .join(" ")
          .toLowerCase()
          .includes(qq)
      );
    }

    return base;
  }, [rows, q, status]);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="text-lg font-extrabold text-slate-100">
              {isSup ? "Rentals — All Branches" : "Rentals — My Branch"}
            </div>
            <div className="text-xs text-slate-400">{loading ? "Loading…" : `${filtered.length} rentals`}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              className="h-10 w-[260px] rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100"
              placeholder="Search… (plate, customer, status, rental_id)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select
              className="h-10 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              className="h-10 rounded-xl border border-indigo-400/60 bg-indigo-500/20 px-3 text-sm text-slate-100"
              onClick={fetchRentals}
            >
              Refresh
            </button>

            <button
              className="h-10 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 px-3 text-sm font-extrabold text-white"
              onClick={() => setCreateOpen(true)}
            >
              + New Rental
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-slate-700/30 bg-slate-900/60">
        <table className="min-w-[1000px] w-full">
          <thead>
            <tr className="text-xs text-slate-400">
              {["ID", "Car", "Customer", "Status", "Start", "Due", "Return", "Amount", "Branch", "Created"].map((h) => (
                <th key={h} className="px-3 py-3 text-left">
                  {h}
                </th>
              ))}
              <th />
            </tr>
          </thead>

          <tbody>
            {!loading &&
              filtered.map((r) => (
                <tr key={r.RENTAL_ID} className="border-t border-slate-700/20 hover:bg-slate-700/10">
                  <td className="px-3 py-3 font-mono text-slate-100">#{r.RENTAL_ID}</td>
                  <td className="px-3 py-3 text-slate-100">
                    <div className="font-mono">{r.LICENSE_PLATE ?? `CAR#${r.CAR_ID}`}</div>
                    <div className="text-xs text-slate-400">
                      {(r.MAKE ?? "").trim()} {(r.MODEL ?? "").trim()}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-100">
                    {(r.CUSTOMER_FIRST_NAME ?? "").trim()} {(r.CUSTOMER_LAST_NAME ?? "").trim()}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(r.STATUS)}`}
                    >
                      {String(r.STATUS).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{fmtDate(r.START_AT)}</td>
                  <td className="px-3 py-3 text-slate-300">{fmtDate(r.DUE_AT)}</td>
                  <td className="px-3 py-3 text-slate-400">{r.RETURN_AT ? fmtDate(r.RETURN_AT) : "—"}</td>
                  <td className="px-3 py-3 text-slate-100">{money(r.TOTAL_AMOUNT, r.CURRENCY)}</td>
                  <td className="px-3 py-3 text-slate-400">{r.BRANCH_CITY ?? `#${r.BRANCH_ID}`}</td>
                  <td className="px-3 py-3 text-slate-400">{fmtDate(r.CREATED_AT)}</td>
                  <td className="px-3 py-3">
                    <button
                      className="rounded-xl bg-slate-700/30 px-3 py-2 text-xs text-slate-100"
                      onClick={() => {
                        setSelected(r);
                        setDrawerOpen(true);
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-slate-400">
                  No rentals found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAILS DRAWER */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-40 bg-black/50 flex justify-end">
          <div className="w-[520px] bg-slate-950 p-4">
            <div className="flex justify-between items-center">
              <div className="font-extrabold text-slate-100">Rental #{selected.RENTAL_ID}</div>
              <button className="text-slate-400 hover:text-slate-100" onClick={() => setDrawerOpen(false)}>
                ✕
              </button>
            </div>
            <pre className="mt-4 text-xs text-slate-300">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-[560px] bg-slate-950 p-5 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold text-slate-100">New Rental</div>
              <button className="text-slate-400 hover:text-slate-100" onClick={() => setCreateOpen(false)}>
                ✕
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {/* Car */}
              <select
                className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                value={form.CAR_ID}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, CAR_ID: v }));
                  // if supervisor selects car, optionally auto set branch from car
                  if (isSup) {
                    const car = cars.find((c) => String(c.CAR_ID) === String(v));
                    if (car?.BRANCH_ID) setForm((f) => ({ ...f, BRANCH_ID: String(car.BRANCH_ID) as any }));
                  }
                }}
              >
                <option value="">Select car (AVAILABLE)...</option>
                {cars.map((c) => (
                  <option key={c.CAR_ID} value={String(c.CAR_ID)}>
                    {c.LICENSE_PLATE} — {c.MAKE} {c.MODEL}
                  </option>
                ))}
              </select>

              {/* Customer */}
              <select
                className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                value={form.CUSTOMER_ID}
                onChange={(e) => setForm((f) => ({ ...f, CUSTOMER_ID: e.target.value }))}
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.CUSTOMER_ID} value={String(c.CUSTOMER_ID)}>
                    {c.FIRST_NAME} {c.LAST_NAME}
                    {c.EMAIL ? ` — ${c.EMAIL}` : ""}
                  </option>
                ))}
              </select>

              {/* Branch (supervisor only) */}
              {isSup && (
                <select
                  className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  value={form.BRANCH_ID}
                  onChange={(e) => setForm((f) => ({ ...f, BRANCH_ID: e.target.value }))}
                >
                  <option value="">Select branch...</option>
                  {branches.map((b) => (
                    <option key={b.BRANCH_ID} value={String(b.BRANCH_ID)}>
                      {b.CITY} — {b.BRANCH_NAME}
                    </option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  type="datetime-local"
                  value={form.START_AT}
                  onChange={(e) => setForm((f) => ({ ...f, START_AT: e.target.value }))}
                />
                <input
                  className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  type="datetime-local"
                  value={form.DUE_AT}
                  onChange={(e) => setForm((f) => ({ ...f, DUE_AT: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  value={form.STATUS}
                  onChange={(e) => setForm((f) => ({ ...f, STATUS: e.target.value }))}
                >
                  {["ACTIVE", "IN_PROGRESS", "CLOSED", "CANCELLED"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <input
                  className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  placeholder="Start odometer"
                  type="number"
                  value={form.START_ODOMETER}
                  onChange={(e) => setForm((f) => ({ ...f, START_ODOMETER: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  placeholder="Total amount"
                  type="number"
                  value={form.TOTAL_AMOUNT}
                  onChange={(e) => setForm((f) => ({ ...f, TOTAL_AMOUNT: e.target.value }))}
                />
                <input
                  className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  placeholder="Currency (MAD)"
                  value={form.CURRENCY}
                  onChange={(e) => setForm((f) => ({ ...f, CURRENCY: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button className="h-10 rounded-xl bg-slate-800 px-4 text-slate-100" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>

                <button
                  className="h-10 rounded-xl bg-indigo-600 px-4 font-extrabold text-white disabled:opacity-60"
                  onClick={() => {
                    // backend expects ISO with milliseconds + Z in our SQL
                    // convert datetime-local => ISO string
                    const start = form.START_AT ? new Date(form.START_AT).toISOString() : "";
                    const due = form.DUE_AT ? new Date(form.DUE_AT).toISOString() : "";
                    setForm((f) => ({ ...f, START_AT: start, DUE_AT: due }));
                    // small delay not needed; just call create with local computed values:
                    (async () => {
                      const saved = { ...form, START_AT: start, DUE_AT: due };
                      setCreating(true);
                      try {
                        const payload: any = {
                          CAR_ID: Number(saved.CAR_ID),
                          CUSTOMER_ID: Number(saved.CUSTOMER_ID),
                          START_AT: saved.START_AT,
                          DUE_AT: saved.DUE_AT,
                          STATUS: saved.STATUS,
                          START_ODOMETER: saved.START_ODOMETER === "" ? null : Number(saved.START_ODOMETER),
                          TOTAL_AMOUNT: saved.TOTAL_AMOUNT === "" ? null : Number(saved.TOTAL_AMOUNT),
                          CURRENCY: saved.CURRENCY,
                        };
                        if (isSup) payload.BRANCH_ID = Number(saved.BRANCH_ID);

                        const res = await fetch(`${API_URL}/api/v1/rentals`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                          },
                          body: JSON.stringify(payload),
                        });

                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

                        setCreateOpen(false);
                        setForm({
                          CAR_ID: "" as any,
                          CUSTOMER_ID: "" as any,
                          BRANCH_ID: "" as any,
                          START_AT: "",
                          DUE_AT: "",
                          STATUS: "ACTIVE",
                          START_ODOMETER: "" as any,
                          TOTAL_AMOUNT: "" as any,
                          CURRENCY: "MAD",
                        });
                        await fetchRentals();
                      } catch (e: any) {
                        alert(e?.message || "Failed to create rental");
                      } finally {
                        setCreating(false);
                      }
                    })();
                  }}
                  disabled={
                    creating ||
                    !form.CAR_ID ||
                    !form.CUSTOMER_ID ||
                    !form.START_AT ||
                    !form.DUE_AT ||
                    (isSup && !form.BRANCH_ID)
                  }
                >
                  {creating ? "Saving..." : "Save"}
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Managers can create rentals for their branch only. Supervisor can pick any branch.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

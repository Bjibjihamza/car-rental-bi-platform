import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { 
  RefreshCw, Plus, X, Calendar, User, 
  Car as CarIcon, MapPin, DollarSign, ArrowRight 
} from "lucide-react";

/* ================= TYPES ================= */
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

const API_URL = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

/* ================= HELPERS ================= */
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function money(amount: number | null, cur: string | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(amount);
}

function badgeTone(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "green";
  if (s === "IN_PROGRESS") return "blue";
  if (s === "CLOSED") return "gray";
  if (s === "CANCELLED") return "red";
  return "amber";
}

/* ================= PAGE ================= */
export function RentalsPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  // Data State
  const [rows, setRows] = useState<RentalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI State
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<RentalRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [form, setForm] = useState({
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

  /* ================= FETCHING ================= */
  async function fetchRentals() {
    if (!user) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/rentals`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) { setErr(e?.message || "Failed to load rentals"); } 
    finally { setLoading(false); }
  }

  // Fetch helpers for modal
  async function fetchOptions() {
      if (!user) return;
      const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      
      // Fetch Cars
      fetch(`${API_URL}/api/v1/cars`, { headers }).then(r => r.json()).then(data => {
          if(Array.isArray(data)) {
              setCars(data.filter((c:any) => c.STATUS === 'AVAILABLE').map((c:any) => ({
                  CAR_ID: c.CAR_ID, LICENSE_PLATE: c.LICENSE_PLATE, MAKE: c.MAKE, MODEL: c.MODEL, BRANCH_ID: c.BRANCH_ID
              })));
          }
      }).catch(() => {});

      // Fetch Customers
      fetch(`${API_URL}/api/v1/customers`, { headers }).then(r => r.json()).then(data => {
          if(Array.isArray(data)) setCustomers(data);
      }).catch(() => {});

      // Fetch Branches (if Supervisor)
      if(isSup) {
          fetch(`${API_URL}/api/v1/branches`, { headers }).then(r => r.json()).then(data => {
              if(Array.isArray(data)) setBranches(data);
          }).catch(() => {});
      }
  }

  async function createRental() {
    if (!user) return;
    setCreating(true);
    try {
      const payload: any = {
        CAR_ID: Number(form.CAR_ID),
        CUSTOMER_ID: Number(form.CUSTOMER_ID),
        START_AT: form.START_AT ? new Date(form.START_AT).toISOString() : null,
        DUE_AT: form.DUE_AT ? new Date(form.DUE_AT).toISOString() : null,
        STATUS: form.STATUS,
        START_ODOMETER: form.START_ODOMETER ? Number(form.START_ODOMETER) : null,
        TOTAL_AMOUNT: form.TOTAL_AMOUNT ? Number(form.TOTAL_AMOUNT) : null,
        CURRENCY: form.CURRENCY,
      };
      if (isSup) payload.BRANCH_ID = Number(form.BRANCH_ID);

      const res = await fetch(`${API_URL}/api/v1/rentals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setCreateOpen(false);
      setForm({ CAR_ID: "", CUSTOMER_ID: "", BRANCH_ID: "", START_AT: "", DUE_AT: "", STATUS: "ACTIVE", START_ODOMETER: "", TOTAL_AMOUNT: "", CURRENCY: "MAD" });
      await fetchRentals();
    } catch (e: any) { alert(e?.message || "Failed to create rental"); } 
    finally { setCreating(false); }
  }

  useEffect(() => { 
      fetchRentals(); 
      fetchOptions();
  }, [user?.role, user?.branchId]);

  /* ================= FILTERING ================= */
  const filtered = useMemo(() => {
    let base = rows;
    const qq = q.trim().toLowerCase();
    if (status !== "ALL") base = base.filter((r) => String(r.STATUS).toUpperCase() === status);
    if (qq) {
      base = base.filter((r) =>
        [r.RENTAL_ID, r.LICENSE_PLATE, r.MAKE, r.MODEL, r.CUSTOMER_FIRST_NAME, r.CUSTOMER_LAST_NAME]
          .join(" ").toLowerCase().includes(qq)
      );
    }
    return base;
  }, [rows, q, status]);

  /* ================= UI RENDER ================= */
  const headerRight = (
    <div className="flex flex-wrap items-center gap-3">
        <div className="relative group hidden md:block">
            <input
                className="h-9 w-48 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:w-64 focus:border-indigo-500/50 outline-none transition-all placeholder:text-neutral-500"
                placeholder="Search rentals..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
            />
        </div>
        <select 
            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500/50"
            value={status} onChange={(e) => setStatus(e.target.value)}
        >
            <option value="ALL" className="bg-[#18181b]">All Status</option>
            {["ACTIVE", "IN_PROGRESS", "CLOSED", "CANCELLED"].map(s => <option key={s} value={s} className="bg-[#18181b]">{s}</option>)}
        </select>
        <button onClick={fetchRentals} className="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition">
            <RefreshCw size={16} />
        </button>
        <button 
            onClick={() => setCreateOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition"
        >
            <Plus size={16} /> New Rental
        </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card 
        title="Rental Management" 
        subtitle="Track active and past rentals"
        right={headerRight}
        className="min-h-[600px]"
      >
         {err && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>}

         <DataTable 
            rows={filtered}
            cols={[
                { key: "RENTAL_ID", header: "ID", render: r => <span className="font-mono text-neutral-500">#{r.RENTAL_ID}</span> },
                { key: "CAR", header: "Vehicle", render: r => (
                    <div className="flex flex-col">
                        <span className="font-bold text-white">{r.MAKE} {r.MODEL}</span>
                        <span className="text-xs font-mono text-neutral-500">{r.LICENSE_PLATE}</span>
                    </div>
                )},
                { key: "CUSTOMER", header: "Customer", render: r => (
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-neutral-800 grid place-items-center text-[10px] text-neutral-400 font-bold">
                            {r.CUSTOMER_FIRST_NAME?.[0]}{r.CUSTOMER_LAST_NAME?.[0]}
                        </div>
                        <span className="text-neutral-300">{r.CUSTOMER_FIRST_NAME} {r.CUSTOMER_LAST_NAME}</span>
                    </div>
                )},
                { key: "STATUS", header: "Status", render: r => <Badge tone={badgeTone(r.STATUS)}>{r.STATUS}</Badge> },
                { key: "DATES", header: "Duration", render: r => (
                    <div className="text-xs">
                        <div className="text-neutral-300">From: {fmtDate(r.START_AT)}</div>
                        <div className="text-neutral-500">To: {fmtDate(r.DUE_AT)}</div>
                    </div>
                )},
                { key: "TOTAL_AMOUNT", header: "Total", render: r => <span className="font-mono text-white">{money(r.TOTAL_AMOUNT, r.CURRENCY)}</span> },
                { key: "BRANCH", header: "Location", render: r => <span className="text-xs text-neutral-400 flex items-center gap-1"><MapPin size={12}/> {r.BRANCH_CITY || `#${r.BRANCH_ID}`}</span> },
                { key: "actions", header: "", render: r => (
                    <button onClick={() => { setSelected(r); setDrawerOpen(true); }} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
                        Details
                    </button>
                )}
            ]}
         />
      </Card>

      {/* DETAILS DRAWER */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="h-full w-full max-w-md border-l border-white/10 bg-[#09090b] shadow-2xl animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-[#121212]">
                    <h2 className="text-lg font-bold text-white">Rental Details</h2>
                    <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 hover:bg-white/10 text-neutral-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Header Card */}
                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-white">Rental #{selected.RENTAL_ID}</h3>
                                <div className="text-neutral-400 text-sm mt-1">{fmtDate(selected.CREATED_AT)}</div>
                            </div>
                            <Badge tone={badgeTone(selected.STATUS)}>{selected.STATUS}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                            <div>
                                <div className="text-xs text-neutral-500 uppercase">Customer</div>
                                <div className="text-white font-medium">{selected.CUSTOMER_FIRST_NAME} {selected.CUSTOMER_LAST_NAME}</div>
                            </div>
                            <div>
                                <div className="text-xs text-neutral-500 uppercase">Total</div>
                                <div className="text-white font-mono font-bold">{money(selected.TOTAL_AMOUNT, selected.CURRENCY)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="rounded-xl border border-white/5 p-4 space-y-3">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2"><CarIcon size={16} className="text-indigo-400"/> Vehicle</h4>
                        <div className="flex justify-between text-sm">
                            <span className="text-neutral-400">Model</span>
                            <span className="text-white">{selected.MAKE} {selected.MODEL}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-neutral-400">Plate</span>
                            <span className="font-mono text-white bg-white/5 px-2 py-0.5 rounded">{selected.LICENSE_PLATE}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-neutral-400">Odometer (Start)</span>
                            <span className="text-white font-mono">{selected.START_ODOMETER ? `${selected.START_ODOMETER} km` : "—"}</span>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="rounded-xl border border-white/5 p-4 space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2"><Calendar size={16} className="text-indigo-400"/> Timeline</h4>
                        <div className="relative pl-4 border-l border-white/10 space-y-6">
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-[#09090b]"></div>
                                <div className="text-xs text-emerald-400 font-bold uppercase">Start</div>
                                <div className="text-white">{fmtDate(selected.START_AT)}</div>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-[#09090b]"></div>
                                <div className="text-xs text-indigo-400 font-bold uppercase">Due</div>
                                <div className="text-white">{fmtDate(selected.DUE_AT)}</div>
                            </div>
                            {selected.RETURN_AT && (
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-neutral-500 ring-4 ring-[#09090b]"></div>
                                    <div className="text-xs text-neutral-400 font-bold uppercase">Returned</div>
                                    <div className="text-white">{fmtDate(selected.RETURN_AT)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#18181b]">
                    <h3 className="text-lg font-bold text-white">Create New Rental</h3>
                    <button onClick={() => setCreateOpen(false)} className="text-neutral-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Car & Customer Selects */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-400">Vehicle</label>
                        <select 
                            className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                            value={form.CAR_ID} 
                            onChange={e => {
                                const v = e.target.value;
                                setForm(f => ({...f, CAR_ID: v}));
                                // Auto-select branch for supervisors based on car
                                if(isSup) {
                                    const c = cars.find(car => String(car.CAR_ID) === v);
                                    if(c?.BRANCH_ID) setForm(f => ({...f, BRANCH_ID: String(c.BRANCH_ID) as any}));
                                }
                            }}
                        >
                            <option value="">Select available vehicle...</option>
                            {cars.map(c => (
                                <option key={c.CAR_ID} value={c.CAR_ID}>{c.LICENSE_PLATE} — {c.MAKE} {c.MODEL}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-400">Customer</label>
                        <select 
                            className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                            value={form.CUSTOMER_ID} onChange={e => setForm(f => ({...f, CUSTOMER_ID: e.target.value}))}
                        >
                            <option value="">Select customer...</option>
                            {customers.map(c => (
                                <option key={c.CUSTOMER_ID} value={c.CUSTOMER_ID}>{c.FIRST_NAME} {c.LAST_NAME}</option>
                            ))}
                        </select>
                    </div>

                    {isSup && (
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Branch</label>
                            <select 
                                className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                                value={form.BRANCH_ID} onChange={e => setForm(f => ({...f, BRANCH_ID: e.target.value}))}
                            >
                                <option value="">Select branch...</option>
                                {branches.map(b => (
                                    <option key={b.BRANCH_ID} value={b.BRANCH_ID}>{b.CITY} — {b.BRANCH_NAME}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Start Date</label>
                            <input type="datetime-local" className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                                value={form.START_AT} onChange={e => setForm(f => ({...f, START_AT: e.target.value}))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Due Date</label>
                            <input type="datetime-local" className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                                value={form.DUE_AT} onChange={e => setForm(f => ({...f, DUE_AT: e.target.value}))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Start Odometer</label>
                            <input type="number" className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                                value={form.START_ODOMETER} onChange={e => setForm(f => ({...f, START_ODOMETER: e.target.value}))} placeholder="0" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Total Amount</label>
                            <input type="number" className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                                value={form.TOTAL_AMOUNT} onChange={e => setForm(f => ({...f, TOTAL_AMOUNT: e.target.value}))} placeholder="0.00" />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                         <button onClick={() => setCreateOpen(false)} className="flex-1 rounded-xl border border-white/10 bg-transparent py-2.5 text-sm font-bold text-white hover:bg-white/5 transition">Cancel</button>
                         <button 
                            onClick={createRental}
                            disabled={creating} 
                            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                        >
                            {creating ? "Creating..." : "Confirm Rental"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { 
  RefreshCw, Plus, X, Cpu, Signal, 
  Wifi, WifiOff, AlertCircle, Smartphone, Edit, Trash2, MapPin
} from "lucide-react";

/* ================= TYPES ================= */
type DeviceRow = {
  DEVICE_ID: number;
  DEVICE_CODE: string;
  DEVICE_IMEI: string | null;
  FIRMWARE_VERSION: string | null;
  STATUS: string;
  ACTIVATED_AT: string | null;
  LAST_SEEN_AT: string | null;
  CREATED_AT: string;
  
  // Assignment Info
  CAR_ID: number | null;
  LICENSE_PLATE: string | null;
  MAKE: string | null;
  MODEL: string | null;

  // Location Info (Calculated by Backend)
  ACTUAL_BRANCH_ID: number | null;
  BRANCH_NAME: string | null;
  BRANCH_CITY: string | null;
  IS_INSTALLED: number; // 1 = in car, 0 = stock
};

type BranchOption = { BRANCH_ID: number; BRANCH_NAME: string; CITY: string };

/* ================= CONFIG & HELPERS ================= */
const API_URL = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function badgeTone(status: string): "green" | "amber" | "gray" | "red" | "blue" {
  const s = String(status).toUpperCase();
  if (s === "ACTIVE") return "green";
  if (s === "INACTIVE") return "amber";
  if (s === "RETIRED") return "red";
  return "gray";
}

// Local Stat Component
function NetworkStat({ label, value, icon: Icon, color }: any) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#121212]/60 p-5 shadow-xl">
            <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full ${color} opacity-10 blur-xl`}></div>
            <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${color} bg-opacity-10 text-white`}>
                    <Icon size={20} />
                </div>
                <div>
                    <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</div>
                    <div className="text-2xl font-bold text-white">{value}</div>
                </div>
            </div>
        </div>
    );
}

/* ================= PAGE ================= */
export function DevicesPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");

  const [selected, setSelected] = useState<DeviceRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<DeviceRow | null>(null);

  const [form, setForm] = useState({
    DEVICE_CODE: "",
    DEVICE_IMEI: "",
    FIRMWARE_VERSION: "",
    STATUS: "INACTIVE",
    BRANCH_ID: "" as any,
  });

  /* ================= API CALLS ================= */
  async function fetchDevices() {
    if (!user) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/devices`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setDevices(Array.isArray(data) ? data : []);
    } catch (e: any) { setErr(e?.message || "Failed to load devices"); } 
    finally { setLoading(false); }
  }

  async function fetchBranches() {
    if (!user || !isSup) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/branches`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (res.ok) setBranches(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function saveDevice() {
    if (!user || !isSup) return;
    setSaving(true);
    try {
      const payload = {
        DEVICE_CODE: form.DEVICE_CODE.trim(),
        DEVICE_IMEI: form.DEVICE_IMEI.trim() || null,
        FIRMWARE_VERSION: form.FIRMWARE_VERSION.trim() || null,
        STATUS: form.STATUS,
        BRANCH_ID: form.BRANCH_ID ? Number(form.BRANCH_ID) : null,
      };

      const url = editMode 
        ? `${API_URL}/api/v1/devices/${editMode.DEVICE_ID}` 
        : `${API_URL}/api/v1/devices`;
      
      const method = editMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      closeModal();
      await fetchDevices();
    } catch (e: any) { alert(e?.message || "Operation failed"); } 
    finally { setSaving(false); }
  }

  async function deleteDevice(id: number) {
      if (!user || !isSup) return;
      if (!window.confirm("Are you sure? This cannot be undone.")) return;

      try {
          const res = await fetch(`${API_URL}/api/v1/devices/${id}`, {
              method: "DELETE",
              headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || "Failed to delete");
          await fetchDevices();
      } catch (e: any) { alert(e.message); }
  }

  // --- HELPERS ---
  function openCreate() {
      setEditMode(null);
      setForm({ DEVICE_CODE: "", DEVICE_IMEI: "", FIRMWARE_VERSION: "", STATUS: "INACTIVE", BRANCH_ID: "" });
      setModalOpen(true);
  }

  function openEdit(row: DeviceRow) {
      setEditMode(row);
      setForm({
          DEVICE_CODE: row.DEVICE_CODE,
          DEVICE_IMEI: row.DEVICE_IMEI || "",
          FIRMWARE_VERSION: row.FIRMWARE_VERSION || "",
          STATUS: row.STATUS,
          BRANCH_ID: row.ACTUAL_BRANCH_ID ? String(row.ACTUAL_BRANCH_ID) : ""
      });
      setModalOpen(true);
  }

  function closeModal() {
      setModalOpen(false);
      setEditMode(null);
  }

  useEffect(() => { 
      fetchDevices(); 
      if (isSup) fetchBranches();
  }, [user?.role, user?.branchId]);

  /* ================= FILTERING & STATS ================= */
  const filtered = useMemo(() => {
    let base = devices.slice();
    const qq = q.trim().toLowerCase();
    if (status !== "ALL") base = base.filter((d) => String(d.STATUS).toUpperCase() === status);
    if (qq) {
      base = base.filter((d) =>
        [d.DEVICE_CODE, d.DEVICE_IMEI || "", d.FIRMWARE_VERSION || "", d.STATUS, d.CAR_ID ? `CAR ${d.CAR_ID}` : "FREE"]
          .join(" ").toLowerCase().includes(qq)
      );
    }
    return base;
  }, [devices, q, status]);

  const stats = useMemo(() => ({
      total: devices.length,
      active: devices.filter(d => d.STATUS === 'ACTIVE').length,
      inactive: devices.filter(d => d.STATUS === 'INACTIVE').length,
      free: devices.filter(d => !d.CAR_ID).length
  }), [devices]);

  /* ================= RENDER ================= */
  const headerRight = (
    <div className="flex flex-wrap items-center gap-3">
        <div className="relative group hidden md:block">
            <input
                className="h-9 w-56 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:w-64 focus:border-indigo-500/50 outline-none transition-all placeholder:text-neutral-500"
                placeholder="Search code, IMEI..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
            />
        </div>

        <select 
            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500/50"
            value={status} onChange={(e) => setStatus(e.target.value)}
        >
            <option value="ALL" className="bg-[#18181b]">All Status</option>
            {["ACTIVE", "INACTIVE", "RETIRED"].map(s => <option key={s} value={s} className="bg-[#18181b]">{s}</option>)}
        </select>

        <button onClick={fetchDevices} className="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition">
            <RefreshCw size={16} />
        </button>

        {isSup && (
            <button 
                onClick={openCreate}
                className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition"
            >
                <Plus size={16} /> Register Device
            </button>
        )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <NetworkStat label="Total Devices" value={stats.total} icon={Cpu} color="bg-indigo-500" />
        <NetworkStat label="Online Active" value={stats.active} icon={Wifi} color="bg-emerald-500" />
        <NetworkStat label="Inactive" value={stats.inactive} icon={WifiOff} color="bg-amber-500" />
        <NetworkStat label="Unassigned" value={stats.free} icon={AlertCircle} color="bg-slate-500" />
      </div>

      {/* 2. Main Card */}
      <Card 
        title="IoT Device Registry" 
        subtitle="Manage hardware, firmware, and vehicle assignments"
        right={headerRight}
        className="min-h-[600px]"
      >
        {err && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>}

        <DataTable 
            rows={filtered}
            cols={[
                { key: "DEVICE_ID", header: "ID", render: r => <span className="font-mono text-neutral-500">#{r.DEVICE_ID}</span> },
                { key: "DEVICE_CODE", header: "Device Code", render: r => (
                    <div className="flex items-center gap-2">
                        <Smartphone size={16} className="text-neutral-500"/>
                        <span className="font-medium text-white">{r.DEVICE_CODE}</span>
                    </div>
                )},
                { key: "STATUS", header: "Status", render: r => <Badge tone={badgeTone(r.STATUS)}>{r.STATUS}</Badge> },
                { key: "BRANCH_ID", header: "Location", render: r => (
                    <div className="flex items-center gap-2">
                        <MapPin size={12} className={r.BRANCH_NAME ? "text-indigo-400" : "text-neutral-600"}/>
                        <div className="flex flex-col">
                            {r.BRANCH_NAME ? (
                                <>
                                    <span className="text-sm text-white font-medium">{r.BRANCH_CITY}</span>
                                    <span className="text-[10px] text-neutral-500">{r.BRANCH_NAME} {r.IS_INSTALLED ? "(Vehicle)" : "(Stock)"}</span>
                                </>
                            ) : (
                                <span className="text-xs text-neutral-500 italic">Global / Unassigned</span>
                            )}
                        </div>
                    </div>
                )},
                { key: "CAR_ID", header: "Assignment", render: r => r.CAR_ID ? (
                    <div className="flex flex-col">
                        <Badge tone="blue">Vehicle #{r.CAR_ID}</Badge>
                        <span className="text-[10px] text-neutral-500 mt-1">{r.MAKE} {r.MODEL}</span>
                    </div>
                ) : (
                    <span className="text-xs text-neutral-500 italic">Unassigned</span>
                )},
                { key: "FIRMWARE_VERSION", header: "Firmware", render: r => <span className="font-mono text-xs text-neutral-400 bg-white/5 px-1.5 py-0.5 rounded">{r.FIRMWARE_VERSION || "v1.0"}</span> },
                { key: "LAST_SEEN_AT", header: "Last Seen", render: r => (
                    <div className="flex items-center gap-2 text-xs">
                        <Signal size={12} className={r.STATUS === 'ACTIVE' ? "text-emerald-500" : "text-neutral-600"} />
                        {fmtDate(r.LAST_SEEN_AT)}
                    </div>
                )},
                { key: "actions", header: "", render: r => (
                    <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setSelected(r); setDrawerOpen(true); }} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
                            View
                        </button>
                        {isSup && (
                            <>
                                <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition" title="Edit">
                                    <Edit size={14}/>
                                </button>
                                <button onClick={() => deleteDevice(r.DEVICE_ID)} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition" title="Delete">
                                    <Trash2 size={14}/>
                                </button>
                            </>
                        )}
                    </div>
                )}
            ]}
        />
      </Card>

      {/* 3. DETAILS DRAWER */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="h-full w-full max-w-md border-l border-white/10 bg-[#09090b] shadow-2xl animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="flex h-full flex-col">
                    <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-[#121212]">
                        <h2 className="text-lg font-bold text-white">Device Details</h2>
                        <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 hover:bg-white/10 text-neutral-400 hover:text-white"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="rounded-xl bg-gradient-to-br from-[#1e1e24] to-[#121212] p-6 border border-white/5 text-center">
                            <div className="mx-auto h-16 w-16 rounded-full bg-indigo-500/10 grid place-items-center mb-4">
                                <Cpu size={32} className="text-indigo-400" />
                            </div>
                            <h3 className="text-2xl font-mono font-bold text-white tracking-wider">{selected.DEVICE_CODE}</h3>
                            <div className="mt-2 flex justify-center gap-2">
                                <Badge tone={badgeTone(selected.STATUS)}>{selected.STATUS}</Badge>
                                <span className="text-xs text-neutral-500 py-1">ID: #{selected.DEVICE_ID}</span>
                            </div>
                        </div>

                        <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <h4 className="text-sm font-bold text-white border-b border-white/5 pb-2">Technical Specs</h4>
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div><div className="text-neutral-500 text-xs">IMEI</div><div className="text-white font-mono">{selected.DEVICE_IMEI || "—"}</div></div>
                                <div><div className="text-neutral-500 text-xs">Firmware</div><div className="text-white font-mono">{selected.FIRMWARE_VERSION || "—"}</div></div>
                                <div><div className="text-neutral-500 text-xs">Registered</div><div className="text-white">{fmtDate(selected.CREATED_AT)}</div></div>
                                <div><div className="text-neutral-500 text-xs">Last Ping</div><div className="text-white">{fmtDate(selected.LAST_SEEN_AT)}</div></div>
                                <div>
                                    <div className="text-neutral-500 text-xs">Location</div>
                                    <div className="text-white">
                                        {selected.BRANCH_NAME ? `${selected.BRANCH_CITY} (${selected.BRANCH_NAME})` : "Global Pool"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {selected.CAR_ID ? (
                             <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
                                <h4 className="text-sm font-bold text-emerald-300 mb-1 flex items-center gap-2">Active Assignment</h4>
                                <p className="text-xs text-emerald-200/60">
                                    Linked to <strong>{selected.MAKE} {selected.MODEL}</strong> ({selected.LICENSE_PLATE}).
                                </p>
                             </div>
                        ) : (
                             <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
                                <h4 className="text-sm font-bold text-amber-300 mb-1 flex items-center gap-2">Unassigned</h4>
                                <p className="text-xs text-amber-200/60">This device is available for new vehicle installation.</p>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 4. CREATE / EDIT MODAL */}
      {modalOpen && isSup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#18181b]">
                    <h3 className="text-lg font-bold text-white">{editMode ? "Edit Device" : "Register IoT Device"}</h3>
                    <button onClick={closeModal} className="text-neutral-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-400">Device Code (Serial)</label>
                        <input className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition" 
                            value={form.DEVICE_CODE} onChange={e => setForm({...form, DEVICE_CODE: e.target.value})} placeholder="e.g. GPS-2024-X99" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">IMEI</label>
                            <input className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition font-mono" 
                                value={form.DEVICE_IMEI} onChange={e => setForm({...form, DEVICE_IMEI: e.target.value})} placeholder="Optional" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Firmware</label>
                            <input className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition" 
                                value={form.FIRMWARE_VERSION} onChange={e => setForm({...form, FIRMWARE_VERSION: e.target.value})} placeholder="v1.0.0" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-400">Assigned Branch (Optional)</label>
                        <select className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                            value={form.BRANCH_ID} onChange={e => setForm({...form, BRANCH_ID: e.target.value})}
                        >
                            <option value="">Global / Unassigned</option>
                            {branches.map(b => <option key={b.BRANCH_ID} value={b.BRANCH_ID}>{b.CITY} — {b.BRANCH_NAME}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-400">Status</label>
                        <select className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                            value={form.STATUS} onChange={e => setForm({...form, STATUS: e.target.value})}
                        >
                            {["ACTIVE", "INACTIVE", "RETIRED"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                         <button onClick={closeModal} className="flex-1 rounded-xl border border-white/10 bg-transparent py-2.5 text-sm font-bold text-white hover:bg-white/5 transition">Cancel</button>
                         <button 
                            onClick={saveDevice}
                            disabled={saving || !form.DEVICE_CODE} 
                            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                        >
                            {saving ? "Saving..." : editMode ? "Update Device" : "Register Device"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
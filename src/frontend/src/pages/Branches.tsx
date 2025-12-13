import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { RefreshCw, Plus, X, MapPin, Building, Phone, Mail, Edit, Trash2 } from "lucide-react";

/* ================= TYPES ================= */
type BranchRow = {
  BRANCH_ID: number;
  BRANCH_NAME: string;
  CITY: string;
  ADDRESS: string | null;
  PHONE: string | null;
  EMAIL: string | null;
  CREATED_AT: string;
};

const API_URL = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

/* ================= PAGE ================= */
export function BranchesPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  const [rows, setRows] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<BranchRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<BranchRow | null>(null); // Null = Create, Object = Edit

  const [form, setForm] = useState({
    BRANCH_NAME: "", CITY: "", ADDRESS: "", PHONE: "", EMAIL: "",
  });

  // --- FETCH ---
  async function fetchBranches() {
    if (!user) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/branches`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) { setErr(e?.message || "Failed to load branches"); } 
    finally { setLoading(false); }
  }

  // --- CREATE / EDIT ---
  async function saveBranch() {
    if (!user || !isSup) return;
    setSaving(true);
    try {
      const payload = {
        BRANCH_NAME: form.BRANCH_NAME.trim(),
        CITY: form.CITY.trim(),
        ADDRESS: form.ADDRESS.trim() || null,
        PHONE: form.PHONE.trim() || null,
        EMAIL: form.EMAIL.trim() || null,
      };

      const url = editMode 
        ? `${API_URL}/api/v1/branches/${editMode.BRANCH_ID}` 
        : `${API_URL}/api/v1/branches`;
      
      const method = editMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      closeModal();
      await fetchBranches();
    } catch (e: any) { alert(e?.message || "Operation failed"); } 
    finally { setSaving(false); }
  }

  // --- DELETE ---
  async function deleteBranch(id: number) {
    if (!user || !isSup) return;
    if (!window.confirm("Are you sure? This cannot be undone. \n(Note: You cannot delete a branch that has cars or managers linked to it)")) return;

    try {
        const res = await fetch(`${API_URL}/api/v1/branches/${id}`, {
            method: "DELETE",
            headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to delete");
        
        await fetchBranches();
    } catch (e: any) {
        alert(e.message);
    }
  }

  // --- HELPERS ---
  function openCreate() {
      setEditMode(null);
      setForm({ BRANCH_NAME: "", CITY: "", ADDRESS: "", PHONE: "", EMAIL: "" });
      setModalOpen(true);
  }

  function openEdit(row: BranchRow) {
      setEditMode(row);
      setForm({
          BRANCH_NAME: row.BRANCH_NAME,
          CITY: row.CITY,
          ADDRESS: row.ADDRESS || "",
          PHONE: row.PHONE || "",
          EMAIL: row.EMAIL || ""
      });
      setModalOpen(true);
  }

  function closeModal() {
      setModalOpen(false);
      setEditMode(null);
  }

  useEffect(() => { fetchBranches(); }, [user?.role, user?.branchId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((b) =>
      [b.BRANCH_NAME, b.CITY, b.ADDRESS || "", b.PHONE || "", b.EMAIL || ""]
        .join(" ").toLowerCase().includes(qq)
    );
  }, [rows, q]);

  // --- RENDER ---
  const headerRight = (
    <div className="flex flex-wrap items-center gap-3">
        <div className="relative group hidden md:block">
            <input
                className="h-9 w-48 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:w-64 focus:border-indigo-500/50 outline-none transition-all placeholder:text-neutral-500"
                placeholder="Search branches..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
            />
        </div>
        <button onClick={fetchBranches} className="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition">
            <RefreshCw size={16} />
        </button>
        {isSup && (
            <button 
                onClick={openCreate}
                className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition"
            >
                <Plus size={16} /> Add Branch
            </button>
        )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <Card 
        title="Branch Network" 
        subtitle="Manage physical locations and contact details"
        right={headerRight}
        className="min-h-[600px]"
      >
         {err && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>}

         <DataTable 
            rows={filtered}
            cols={[
                { key: "BRANCH_ID", header: "ID", render: r => <span className="font-mono text-neutral-500">#{r.BRANCH_ID}</span> },
                { key: "CITY", header: "City", render: r => <span className="font-bold text-white">{r.CITY}</span> },
                { key: "BRANCH_NAME", header: "Branch Name", render: r => <span className="text-neutral-300">{r.BRANCH_NAME}</span> },
                { key: "ADDRESS", header: "Address", render: r => (
                    <div className="flex items-center gap-2 text-neutral-400 max-w-[200px] truncate">
                        <MapPin size={14} /> {r.ADDRESS || "—"}
                    </div>
                )},
                { key: "PHONE", header: "Phone", render: r => <span className="font-mono text-xs text-neutral-400">{r.PHONE || "—"}</span> },
                { key: "EMAIL", header: "Email", render: r => <span className="text-xs text-neutral-400">{r.EMAIL || "—"}</span> },
                { key: "actions", header: "", render: r => (
                    <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setSelected(r); setDrawerOpen(true); }} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
                            View
                        </button>
                        
                        {/* EDIT / DELETE FOR SUPERVISOR ONLY */}
                        {isSup && (
                            <>
                                <button 
                                    onClick={() => openEdit(r)}
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
                                    title="Edit Branch"
                                >
                                    <Edit size={14} />
                                </button>
                                <button 
                                    onClick={() => deleteBranch(r.BRANCH_ID)}
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition"
                                    title="Delete Branch"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </>
                        )}
                    </div>
                )}
            ]}
         />
      </Card>

      {/* DRAWER (View Details) */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="h-full w-full max-w-md border-l border-white/10 bg-[#09090b] shadow-2xl animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-[#121212]">
                    <h2 className="text-lg font-bold text-white">Branch Details</h2>
                    <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 hover:bg-white/10 text-neutral-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="rounded-xl bg-gradient-to-br from-indigo-900/20 to-transparent p-6 border border-white/5 text-center">
                         <div className="mx-auto h-16 w-16 rounded-full bg-indigo-500/10 grid place-items-center mb-4">
                              <Building size={32} className="text-indigo-400" />
                         </div>
                         <h3 className="text-2xl font-bold text-white">{selected.CITY}</h3>
                         <div className="text-neutral-400 mt-1">{selected.BRANCH_NAME}</div>
                         <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                            ID: #{selected.BRANCH_ID}
                         </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                        <h4 className="text-sm font-bold text-white border-b border-white/5 pb-2">Contact Information</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <MapPin size={16} className="text-neutral-500 shrink-0"/>
                                <span className="text-neutral-300">{selected.ADDRESS || "No address provided"}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Phone size={16} className="text-neutral-500 shrink-0"/>
                                <span className="text-neutral-300">{selected.PHONE || "No phone provided"}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Mail size={16} className="text-neutral-500 shrink-0"/>
                                <span className="text-neutral-300">{selected.EMAIL || "No email provided"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && isSup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#18181b]">
                    <h3 className="text-lg font-bold text-white">
                        {editMode ? "Edit Branch" : "Add New Branch"}
                    </h3>
                    <button onClick={closeModal} className="text-neutral-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Branch Name</label>
                            <input className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition" 
                                value={form.BRANCH_NAME} onChange={e => setForm({...form, BRANCH_NAME: e.target.value})} placeholder="e.g. Downtown Hub" />
                         </div>
                         <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">City</label>
                            <input className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition" 
                                value={form.CITY} onChange={e => setForm({...form, CITY: e.target.value})} placeholder="e.g. Tetouan" />
                         </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-400">Address</label>
                        <input className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition" 
                            value={form.ADDRESS} onChange={e => setForm({...form, ADDRESS: e.target.value})} placeholder="123 Main St..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Phone</label>
                            <input className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition" 
                                value={form.PHONE} onChange={e => setForm({...form, PHONE: e.target.value})} placeholder="+212..." />
                         </div>
                         <div className="space-y-1">
                            <label className="text-xs font-medium text-neutral-400">Email</label>
                            <input className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition" 
                                value={form.EMAIL} onChange={e => setForm({...form, EMAIL: e.target.value})} placeholder="branch@company.com" />
                         </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                         <button onClick={closeModal} className="flex-1 rounded-xl border border-white/10 bg-transparent py-2.5 text-sm font-bold text-white hover:bg-white/5 transition">Cancel</button>
                         <button 
                            onClick={saveBranch}
                            disabled={saving || !form.BRANCH_NAME || !form.CITY} 
                            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                        >
                            {saving ? "Saving..." : editMode ? "Update Branch" : "Save Branch"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
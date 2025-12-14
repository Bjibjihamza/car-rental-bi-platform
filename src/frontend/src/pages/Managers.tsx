// src/frontend/src/pages/Managers.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import {
  RefreshCw,
  Plus,
  X,
  Briefcase,
  Mail,
  Phone,
  Calendar,
  Edit,
  Trash2,
  Building2,
  Hash,
  Shield,
} from "lucide-react";

/* ================= TYPES ================= */
type ManagerRow = {
  MANAGER_ID: number;
  MANAGER_CODE: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
  PHONE: string | null;
  ROLE: "SUPERVISOR" | "MANAGER" | string;
  BRANCH_ID: number | null;
  HIRE_DATE: string;
};

type BranchRow = { BRANCH_ID: number; CITY: string; BRANCH_NAME: string };

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

function roleBadgeTone(role: string) {
  const r = String(role || "").toUpperCase();
  if (r === "SUPERVISOR") return "purple";
  return "green";
}

function branchLabel(branch?: BranchRow | null) {
  if (!branch) return "HQ / Remote";
  return `${branch.CITY} — ${branch.BRANCH_NAME}`;
}

/* ================= PAGE ================= */
export function ManagersPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  const [rows, setRows] = useState<ManagerRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("ALL");

  const [selected, setSelected] = useState<ManagerRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<ManagerRow | null>(null);

  const [form, setForm] = useState({
    MANAGER_CODE: "",
    FIRST_NAME: "",
    LAST_NAME: "",
    EMAIL: "",
    PHONE: "",
    ROLE: "MANAGER",
    BRANCH_ID: "" as any,
    MANAGER_PASSWORD: "",
  });

  const authHeaders = useMemo(
    () => ({
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // --- FETCH ---
  async function fetchManagers() {
    if (!user) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/managers`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load managers");
    } finally {
      setLoading(false);
    }
  }

  async function fetchBranches() {
    // we need this even if not supervisor, because we display branch names in table/drawer
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/branches`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (res.ok) setBranches(Array.isArray(data) ? data : []);
    } catch {}
  }

  // --- CREATE / EDIT ---
  async function saveManager() {
    if (!user || !isSup) return;

    // disallow editing supervisor from this page
    if (editMode && String(editMode.ROLE || "").toUpperCase() === "SUPERVISOR") return;

    setSaving(true);
    try {
      const payload: any = {
        MANAGER_CODE: form.MANAGER_CODE.trim(),
        FIRST_NAME: form.FIRST_NAME.trim(),
        LAST_NAME: form.LAST_NAME.trim(),
        EMAIL: form.EMAIL.trim(),
        PHONE: form.PHONE.trim() || null,
        ROLE: form.ROLE,
        BRANCH_ID: form.ROLE === "MANAGER" ? Number(form.BRANCH_ID) : null,
      };

      // only send password if provided (create always requires it on backend, edit optional)
      if (String(form.MANAGER_PASSWORD || "").trim()) {
        payload.MANAGER_PASSWORD = form.MANAGER_PASSWORD;
      }

      const url = editMode
        ? `${API_URL}/api/v1/managers/${editMode.MANAGER_ID}`
        : `${API_URL}/api/v1/managers`;

      const method = editMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      closeModal();
      await fetchManagers();
    } catch (e: any) {
      alert(e?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  }

  // --- DELETE ---
  async function deleteManager(row: ManagerRow) {
    if (!user || !isSup) return;

    // supervisor can't be deleted
    if (String(row.ROLE || "").toUpperCase() === "SUPERVISOR") return;

    if (
      !window.confirm(
        "Are you sure you want to delete this staff member? This cannot be undone."
      )
    )
      return;

    try {
      const res = await fetch(`${API_URL}/api/v1/managers/${row.MANAGER_ID}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete");
      await fetchManagers();
    } catch (e: any) {
      alert(e.message);
    }
  }

  // --- HELPERS ---
  function openCreate() {
    setEditMode(null);
    setForm({
      MANAGER_CODE: "",
      FIRST_NAME: "",
      LAST_NAME: "",
      EMAIL: "",
      PHONE: "",
      ROLE: "MANAGER",
      BRANCH_ID: "",
      MANAGER_PASSWORD: "",
    });
    setModalOpen(true);
  }

  function openEdit(row: ManagerRow) {
    // supervisor can't be edited from this page
    if (String(row.ROLE || "").toUpperCase() === "SUPERVISOR") return;

    setEditMode(row);
    setForm({
      MANAGER_CODE: row.MANAGER_CODE,
      FIRST_NAME: row.FIRST_NAME,
      LAST_NAME: row.LAST_NAME,
      EMAIL: row.EMAIL,
      PHONE: row.PHONE || "",
      ROLE: String(row.ROLE || "").toUpperCase() === "SUPERVISOR" ? "SUPERVISOR" : "MANAGER",
      BRANCH_ID: row.BRANCH_ID ? String(row.BRANCH_ID) : "",
      MANAGER_PASSWORD: "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditMode(null);
  }

  useEffect(() => {
    fetchManagers();
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.branchId, token]);

  const branchMap = useMemo(() => {
    const m = new Map<number, BranchRow>();
    branches.forEach((b) => m.set(b.BRANCH_ID, b));
    return m;
  }, [branches]);

  const filtered = useMemo(() => {
    let base = rows;

    if (role !== "ALL") {
      base = base.filter((m) => String(m.ROLE).toUpperCase() === role);
    }

    const qq = q.trim().toLowerCase();
    if (qq) {
      base = base.filter((m) =>
        [
          m.MANAGER_CODE,
          m.FIRST_NAME,
          m.LAST_NAME,
          m.EMAIL,
          m.PHONE || "",
          String(m.ROLE || ""),
          m.BRANCH_ID ? branchLabel(branchMap.get(m.BRANCH_ID) || null) : "hq remote",
        ]
          .join(" ")
          .toLowerCase()
          .includes(qq)
      );
    }

    return base;
  }, [rows, q, role, branchMap]);

  const headerRight = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative group hidden md:block">
        <input
          className="h-9 w-48 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:w-64 focus:border-indigo-500/50 outline-none transition-all placeholder:text-neutral-500"
          placeholder="Search staff..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <select
        className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-500/50"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="ALL" className="bg-[#18181b]">
          All Roles
        </option>
        <option value="MANAGER" className="bg-[#18181b]">
          MANAGER
        </option>
        <option value="SUPERVISOR" className="bg-[#18181b]">
          SUPERVISOR
        </option>
      </select>

      <button
        onClick={() => {
          fetchManagers();
          fetchBranches();
        }}
        className="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition"
        title="Refresh"
      >
        <RefreshCw size={16} />
      </button>

      {isSup && (
        <button
          onClick={openCreate}
          className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition"
        >
          <Plus size={16} /> Add Staff
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card
        title="Staff Directory"
        subtitle="Manage managers and supervisors"
        right={headerRight}
        className="min-h-[600px]"
      >
        {err && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {err}
          </div>
        )}

        <DataTable
          rows={filtered}
          cols={[
            {
              key: "MANAGER_ID",
              header: "ID",
              render: (r) => (
                <span className="font-mono text-neutral-500">#{r.MANAGER_ID}</span>
              ),
            },
            {
              key: "FIRST_NAME",
              header: "Name",
              render: (r) => (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 grid place-items-center text-xs font-bold">
                    {(r.FIRST_NAME?.[0] || "U").toUpperCase()}
                    {(r.LAST_NAME?.[0] || "U").toUpperCase()}
                  </div>
                  <span className="font-bold text-white">
                    {r.FIRST_NAME} {r.LAST_NAME}
                  </span>
                </div>
              ),
            },
            {
              key: "MANAGER_CODE",
              header: "Code",
              render: (r) => (
                <span className="font-mono text-xs text-neutral-400">
                  {r.MANAGER_CODE}
                </span>
              ),
            },
            {
              key: "EMAIL",
              header: "Email",
              render: (r) => (
                <span className="text-xs text-neutral-300">{r.EMAIL}</span>
              ),
            },
            {
              key: "ROLE",
              header: "Role",
              render: (r) => (
                <Badge tone={roleBadgeTone(r.ROLE)}>{String(r.ROLE || "")}</Badge>
              ),
            },
            {
              key: "BRANCH_ID",
              header: "Branch",
              render: (r) => {
                const b = r.BRANCH_ID ? branchMap.get(r.BRANCH_ID) : null;
                return b ? (
                  <span className="text-neutral-300">{branchLabel(b)}</span>
                ) : (
                  <span className="text-neutral-600 italic">HQ / Remote</span>
                );
              },
            },
            {
              key: "actions",
              header: "",
              render: (r) => {
                const isRowSup = String(r.ROLE || "").toUpperCase() === "SUPERVISOR";
                return (
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => {
                        setSelected(r);
                        setDrawerOpen(true);
                      }}
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      Details
                    </button>

                    {isSup && !isRowSup && (
                      <>
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => deleteManager(r)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      {/* DRAWER */}
      {drawerOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="h-full w-full max-w-md border-l border-white/10 bg-[#09090b] shadow-2xl animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-[#121212]">
              <h2 className="text-lg font-bold text-white">Staff Details</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 hover:bg-white/10 text-neutral-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="rounded-2xl bg-white/[0.02] p-6 border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-600 grid place-items-center text-xl font-extrabold text-white shadow-lg shadow-indigo-600/20">
                    {(selected.FIRST_NAME?.[0] || "U").toUpperCase()}
                    {(selected.LAST_NAME?.[0] || "U").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xl font-bold text-white">
                      {selected.FIRST_NAME} {selected.LAST_NAME}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={roleBadgeTone(selected.ROLE)}>
                        {String(selected.ROLE || "")}
                      </Badge>
                      <span className="text-xs text-neutral-500">
                        ID #{selected.MANAGER_ID}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-neutral-400 truncate">
                      {selected.EMAIL}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                <h4 className="text-sm font-bold text-white border-b border-white/5 pb-2">
                  Full Details
                </h4>

                <DetailRow
                  icon={Briefcase}
                  label="Manager Code"
                  value={selected.MANAGER_CODE}
                />
                <DetailRow icon={Mail} label="Email" value={selected.EMAIL} />
                <DetailRow
                  icon={Phone}
                  label="Phone"
                  value={selected.PHONE || "No phone provided"}
                />
                <DetailRow
                  icon={Shield}
                  label="Role"
                  value={String(selected.ROLE || "")}
                />
                <DetailRow
                  icon={Building2}
                  label="Branch"
                  value={
                    selected.BRANCH_ID
                      ? branchLabel(branchMap.get(selected.BRANCH_ID) || null)
                      : "HQ / Remote"
                  }
                />
                <DetailRow
                  icon={Calendar}
                  label="Hire Date"
                  value={fmtDate(selected.HIRE_DATE)}
                />
                <DetailRow
                  icon={Hash}
                  label="Manager ID"
                  value={`#${selected.MANAGER_ID}`}
                />
              </div>

              {isSup && String(selected.ROLE || "").toUpperCase() !== "SUPERVISOR" && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => openEdit(selected)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => deleteManager(selected)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-bold text-red-200 hover:bg-red-500/15 transition"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              )}
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
                {editMode ? "Edit Staff Member" : "Add Staff Member"}
              </h3>
              <button onClick={closeModal} className="text-neutral-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-400">
                  Employee Code
                </label>
                <input
                  className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                  value={form.MANAGER_CODE}
                  onChange={(e) => setForm({ ...form, MANAGER_CODE: e.target.value })}
                  placeholder="e.g. MGR101"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-400">
                    First Name
                  </label>
                  <input
                    className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                    value={form.FIRST_NAME}
                    onChange={(e) => setForm({ ...form, FIRST_NAME: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-400">
                    Last Name
                  </label>
                  <input
                    className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                    value={form.LAST_NAME}
                    onChange={(e) => setForm({ ...form, LAST_NAME: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-400">Email</label>
                <input
                  className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                  value={form.EMAIL}
                  onChange={(e) => setForm({ ...form, EMAIL: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-400">Role</label>
                  <select
                    className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                    value={form.ROLE}
                    onChange={(e) => setForm({ ...form, ROLE: e.target.value })}
                  >
                    <option value="MANAGER">MANAGER</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-400">Phone</label>
                  <input
                    className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                    value={form.PHONE}
                    onChange={(e) => setForm({ ...form, PHONE: e.target.value })}
                  />
                </div>
              </div>

              {form.ROLE === "MANAGER" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-400">
                    Assigned Branch
                  </label>
                  <select
                    className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                    value={form.BRANCH_ID}
                    onChange={(e) => setForm({ ...form, BRANCH_ID: e.target.value })}
                  >
                    <option value="">Select Branch...</option>
                    {branches.map((b) => (
                      <option key={b.BRANCH_ID} value={b.BRANCH_ID}>
                        {b.CITY} — {b.BRANCH_NAME}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-400">
                  Password {editMode && "(leave empty to keep unchanged)"}
                </label>
                <input
                  type="password"
                  className="w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition"
                  value={form.MANAGER_PASSWORD}
                  onChange={(e) =>
                    setForm({ ...form, MANAGER_PASSWORD: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-white/10 bg-transparent py-2.5 text-sm font-bold text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveManager}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : editMode ? "Update Account" : "Create Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= UI HELPERS ================= */
function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-neutral-400 shrink-0">
          <Icon size={16} />
        </span>
        <span className="text-sm text-neutral-400">{label}</span>
      </div>
      <div className="text-sm font-bold text-white text-right truncate max-w-[60%]">
        {value}
      </div>
    </div>
  );
}

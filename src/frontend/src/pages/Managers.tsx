// src/frontend/src/pages/ManagersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

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

function roleBadge(role: string) {
  const r = role.toUpperCase();
  if (r === "SUPERVISOR") return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
}

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

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
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

  async function fetchManagers() {
    if (!user) return;
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/managers`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load managers");
    } finally {
      setLoading(false);
    }
  }

  async function fetchBranches() {
    if (!user || !isSup) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/branches`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => []);
      if (res.ok) setBranches(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function createManager() {
    if (!user || !isSup) return;

    setCreating(true);
    try {
      const payload = {
        MANAGER_CODE: form.MANAGER_CODE.trim(),
        FIRST_NAME: form.FIRST_NAME.trim(),
        LAST_NAME: form.LAST_NAME.trim(),
        EMAIL: form.EMAIL.trim(),
        PHONE: form.PHONE.trim() ? form.PHONE.trim() : null,
        ROLE: form.ROLE,
        BRANCH_ID: form.ROLE === "MANAGER" ? Number(form.BRANCH_ID) : null,
        MANAGER_PASSWORD: form.MANAGER_PASSWORD,
      };

      const res = await fetch(`${API_URL}/api/v1/managers`, {
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
        MANAGER_CODE: "",
        FIRST_NAME: "",
        LAST_NAME: "",
        EMAIL: "",
        PHONE: "",
        ROLE: "MANAGER",
        BRANCH_ID: "" as any,
        MANAGER_PASSWORD: "",
      });

      await fetchManagers();
    } catch (e: any) {
      alert(e?.message || "Failed to create manager");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    fetchManagers();
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.branchId]);

  const roleOptions = useMemo(
    () => Array.from(new Set(rows.map((m) => String(m.ROLE || "").toUpperCase()))).filter(Boolean),
    [rows]
  );

  const filtered = useMemo(() => {
    let base = rows.slice();
    const qq = q.trim().toLowerCase();

    if (role !== "ALL") base = base.filter((m) => String(m.ROLE).toUpperCase() === role);

    if (qq) {
      base = base.filter((m) =>
        [m.MANAGER_CODE, m.FIRST_NAME, m.LAST_NAME, m.EMAIL, m.PHONE || "", String(m.BRANCH_ID ?? "")]
          .join(" ")
          .toLowerCase()
          .includes(qq)
      );
    }

    return base;
  }, [rows, q, role]);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="text-lg font-extrabold text-slate-100">Managers</div>
            <div className="text-xs text-slate-400">{loading ? "Loading…" : `${filtered.length} managers`}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              className="h-10 w-[280px] rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100"
              placeholder="Search… (code, name, email)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select
              className="h-10 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="ALL">All roles</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <button
              className="h-10 rounded-xl border border-indigo-400/60 bg-indigo-500/20 px-3 text-sm text-slate-100"
              onClick={fetchManagers}
            >
              Refresh
            </button>

            {isSup && (
              <button
                className="h-10 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 px-3 text-sm font-extrabold text-white"
                onClick={() => setCreateOpen(true)}
              >
                + Add Manager
              </button>
            )}
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-slate-700/30 bg-slate-900/60">
        <table className="min-w-[980px] w-full">
          <thead>
            <tr className="text-xs text-slate-400">
              {["ID", "Code", "Name", "Email", "Role", "Branch", "Hire date"].map((h) => (
                <th key={h} className="px-3 py-3 text-left">{h}</th>
              ))}
              <th />
            </tr>
          </thead>

          <tbody>
            {!loading &&
              filtered.map((m) => (
                <tr key={m.MANAGER_ID} className="border-t border-slate-700/20 hover:bg-slate-700/10">
                  <td className="px-3 py-3 font-mono text-slate-100">#{m.MANAGER_ID}</td>
                  <td className="px-3 py-3 font-mono text-slate-100">{m.MANAGER_CODE}</td>
                  <td className="px-3 py-3 text-slate-100">
                    {m.FIRST_NAME} {m.LAST_NAME}
                  </td>
                  <td className="px-3 py-3 text-slate-300">{m.EMAIL}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${roleBadge(m.ROLE)}`}>
                      {String(m.ROLE).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{m.BRANCH_ID ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-400">{fmtDate(m.HIRE_DATE)}</td>
                  <td className="px-3 py-3">
                    <button
                      className="rounded-xl bg-slate-700/30 px-3 py-2 text-xs text-slate-100"
                      onClick={() => {
                        setSelected(m);
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
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No managers found</td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawerOpen && selected && (
        <div className="fixed inset-0 z-40 bg-black/50 flex justify-end">
          <div className="w-[460px] bg-slate-950 p-4">
            <div className="flex justify-between items-center">
              <div className="font-extrabold text-slate-100">
                {selected.FIRST_NAME} {selected.LAST_NAME}
              </div>
              <button className="text-slate-400 hover:text-slate-100" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <pre className="mt-4 text-xs text-slate-300">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}

      {createOpen && isSup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-[520px] bg-slate-950 p-5 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold text-slate-100">Add Manager</div>
              <button className="text-slate-400 hover:text-slate-100" onClick={() => setCreateOpen(false)}>✕</button>
            </div>

            <div className="mt-4 grid gap-3">
              <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Manager Code"
                value={form.MANAGER_CODE}
                onChange={(e) => setForm({ ...form, MANAGER_CODE: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  placeholder="First name"
                  value={form.FIRST_NAME}
                  onChange={(e) => setForm({ ...form, FIRST_NAME: e.target.value })}
                />
                <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  placeholder="Last name"
                  value={form.LAST_NAME}
                  onChange={(e) => setForm({ ...form, LAST_NAME: e.target.value })}
                />
              </div>

              <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Email"
                value={form.EMAIL}
                onChange={(e) => setForm({ ...form, EMAIL: e.target.value })}
              />
              <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Phone (optional)"
                value={form.PHONE}
                onChange={(e) => setForm({ ...form, PHONE: e.target.value })}
              />

              <select
                className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                value={form.ROLE}
                onChange={(e) => setForm({ ...form, ROLE: e.target.value })}
              >
                <option value="MANAGER">MANAGER</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
              </select>

              {form.ROLE === "MANAGER" && (
                <select
                  className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                  value={form.BRANCH_ID}
                  onChange={(e) => setForm({ ...form, BRANCH_ID: e.target.value })}
                >
                  <option value="">Select branch…</option>
                  {branches.map((b) => (
                    <option key={b.BRANCH_ID} value={String(b.BRANCH_ID)}>
                      {b.CITY} — {b.BRANCH_NAME}
                    </option>
                  ))}
                </select>
              )}

              <input
                className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Password"
                type="password"
                value={form.MANAGER_PASSWORD}
                onChange={(e) => setForm({ ...form, MANAGER_PASSWORD: e.target.value })}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button className="h-10 rounded-xl bg-slate-800 px-4 text-slate-100" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>

                <button
                  className="h-10 rounded-xl bg-indigo-600 px-4 font-extrabold text-white disabled:opacity-60"
                  onClick={createManager}
                  disabled={
                    creating ||
                    !form.MANAGER_CODE.trim() ||
                    !form.FIRST_NAME.trim() ||
                    !form.LAST_NAME.trim() ||
                    !form.EMAIL.trim() ||
                    !form.MANAGER_PASSWORD.trim() ||
                    (form.ROLE === "MANAGER" && !form.BRANCH_ID)
                  }
                >
                  {creating ? "Saving..." : "Save"}
                </button>
              </div>

              <div className="text-xs text-slate-500">Supervisor only — managers can’t create users.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

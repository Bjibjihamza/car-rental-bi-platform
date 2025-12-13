// src/frontend/src/pages/BranchesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

type BranchRow = {
  BRANCH_ID: number;
  BRANCH_NAME: string;
  CITY: string;
  ADDRESS: string | null;
  PHONE: string | null;
  EMAIL: string | null;
  CREATED_AT: string;
};

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function BranchesPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  const [rows, setRows] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");

  const [selected, setSelected] = useState<BranchRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    BRANCH_NAME: "",
    CITY: "",
    ADDRESS: "",
    PHONE: "",
    EMAIL: "",
  });

  async function fetchBranches() {
    if (!user) return;
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/branches`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }

  async function createBranch() {
    if (!user || !isSup) return;
    setCreating(true);

    try {
      const payload = {
        BRANCH_NAME: form.BRANCH_NAME.trim(),
        CITY: form.CITY.trim(),
        ADDRESS: form.ADDRESS.trim() ? form.ADDRESS.trim() : null,
        PHONE: form.PHONE.trim() ? form.PHONE.trim() : null,
        EMAIL: form.EMAIL.trim() ? form.EMAIL.trim() : null,
      };

      const res = await fetch(`${API_URL}/api/v1/branches`, {
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
      setForm({ BRANCH_NAME: "", CITY: "", ADDRESS: "", PHONE: "", EMAIL: "" });
      await fetchBranches();
    } catch (e: any) {
      alert(e?.message || "Failed to create branch");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.branchId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((b) =>
      [b.BRANCH_NAME, b.CITY, b.ADDRESS || "", b.PHONE || "", b.EMAIL || ""]
        .join(" ")
        .toLowerCase()
        .includes(qq)
    );
  }, [rows, q]);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="text-lg font-extrabold text-slate-100">Branches</div>
            <div className="text-xs text-slate-400">{loading ? "Loading…" : `${filtered.length} branches`}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              className="h-10 w-[280px] rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100"
              placeholder="Search… (city, name, phone, email)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <button
              className="h-10 rounded-xl border border-indigo-400/60 bg-indigo-500/20 px-3 text-sm text-slate-100"
              onClick={fetchBranches}
            >
              Refresh
            </button>

            {isSup && (
              <button
                className="h-10 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 px-3 text-sm font-extrabold text-white"
                onClick={() => setCreateOpen(true)}
              >
                + Add Branch
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
              {["ID", "City", "Branch", "Address", "Phone", "Email", "Created"].map((h) => (
                <th key={h} className="px-3 py-3 text-left">{h}</th>
              ))}
              <th />
            </tr>
          </thead>

          <tbody>
            {!loading &&
              filtered.map((b) => (
                <tr key={b.BRANCH_ID} className="border-t border-slate-700/20 hover:bg-slate-700/10">
                  <td className="px-3 py-3 font-mono text-slate-100">#{b.BRANCH_ID}</td>
                  <td className="px-3 py-3 text-slate-100">{b.CITY}</td>
                  <td className="px-3 py-3 text-slate-100">{b.BRANCH_NAME}</td>
                  <td className="px-3 py-3 text-slate-300">{b.ADDRESS || "—"}</td>
                  <td className="px-3 py-3 text-slate-300">{b.PHONE || "—"}</td>
                  <td className="px-3 py-3 text-slate-300">{b.EMAIL || "—"}</td>
                  <td className="px-3 py-3 text-slate-400">{fmtDate(b.CREATED_AT)}</td>
                  <td className="px-3 py-3">
                    <button
                      className="rounded-xl bg-slate-700/30 px-3 py-2 text-xs text-slate-100"
                      onClick={() => {
                        setSelected(b);
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
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No branches found
                </td>
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
                {selected.CITY} — {selected.BRANCH_NAME}
              </div>
              <button className="text-slate-400 hover:text-slate-100" onClick={() => setDrawerOpen(false)}>
                ✕
              </button>
            </div>
            <pre className="mt-4 text-xs text-slate-300">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}

      {createOpen && isSup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-[520px] bg-slate-950 p-5 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold text-slate-100">Add Branch</div>
              <button className="text-slate-400 hover:text-slate-100" onClick={() => setCreateOpen(false)}>✕</button>
            </div>

            <div className="mt-4 grid gap-3">
              <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Branch name"
                value={form.BRANCH_NAME}
                onChange={(e) => setForm({ ...form, BRANCH_NAME: e.target.value })}
              />
              <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="City"
                value={form.CITY}
                onChange={(e) => setForm({ ...form, CITY: e.target.value })}
              />
              <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Address (optional)"
                value={form.ADDRESS}
                onChange={(e) => setForm({ ...form, ADDRESS: e.target.value })}
              />
              <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Phone (optional)"
                value={form.PHONE}
                onChange={(e) => setForm({ ...form, PHONE: e.target.value })}
              />
              <input className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Email (optional)"
                value={form.EMAIL}
                onChange={(e) => setForm({ ...form, EMAIL: e.target.value })}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button className="h-10 rounded-xl bg-slate-800 px-4 text-slate-100" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button
                  className="h-10 rounded-xl bg-indigo-600 px-4 font-extrabold text-white disabled:opacity-60"
                  onClick={createBranch}
                  disabled={creating || !form.BRANCH_NAME.trim() || !form.CITY.trim()}
                >
                  {creating ? "Saving..." : "Save"}
                </button>
              </div>

              <div className="text-xs text-slate-500">Supervisor only — managers can’t create branches.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

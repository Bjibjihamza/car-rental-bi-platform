// src/frontend/src/pages/DevicesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

/* ================= TYPES ================= */
type DeviceRow = {
  DEVICE_ID: number;
  DEVICE_CODE: string;
  DEVICE_IMEI: string | null;
  FIRMWARE_VERSION: string | null;
  STATUS: "ACTIVE" | "INACTIVE" | "RETIRED" | string;
  ACTIVATED_AT: string | null;
  LAST_SEEN_AT: string | null;
  CREATED_AT: string;
  CAR_ID: number | null;
  BRANCH_ID: number | null;
};

/* ================= CONFIG ================= */
const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

/* ================= HELPERS ================= */
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function statusBadgeClass(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (s === "INACTIVE") return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  return "bg-slate-500/15 text-slate-300 border-slate-500/25";
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-100">{value}</div>
    </div>
  );
}

/* ================= PAGE ================= */
export function DevicesPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");

  const [selected, setSelected] = useState<DeviceRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    DEVICE_CODE: "",
    DEVICE_IMEI: "",
    FIRMWARE_VERSION: "",
    STATUS: "INACTIVE",
  });

  async function fetchDevices() {
    if (!user) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/devices`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setDevices(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }

  async function createDevice() {
    if (!user || !isSup) return;

    setCreating(true);
    try {
      const payload = {
        DEVICE_CODE: form.DEVICE_CODE.trim(),
        DEVICE_IMEI: form.DEVICE_IMEI.trim() ? form.DEVICE_IMEI.trim() : null,
        FIRMWARE_VERSION: form.FIRMWARE_VERSION.trim() ? form.FIRMWARE_VERSION.trim() : null,
        STATUS: form.STATUS,
      };

      const res = await fetch(`${API_URL}/api/v1/devices`, {
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
      setForm({ DEVICE_CODE: "", DEVICE_IMEI: "", FIRMWARE_VERSION: "", STATUS: "INACTIVE" });
      await fetchDevices();
    } catch (e: any) {
      alert(e?.message || "Failed to create device");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.branchId]);

  const statusOptions = useMemo(
    () => Array.from(new Set(devices.map((d) => String(d.STATUS || "").toUpperCase()))).filter(Boolean),
    [devices]
  );

  const filtered = useMemo(() => {
    let base = devices.slice();
    const qq = q.trim().toLowerCase();

    if (status !== "ALL") base = base.filter((d) => String(d.STATUS).toUpperCase() === status);

    if (qq) {
      base = base.filter((d) =>
        [
          d.DEVICE_CODE,
          d.DEVICE_IMEI || "",
          d.FIRMWARE_VERSION || "",
          d.STATUS,
          d.CAR_ID ? `CAR ${d.CAR_ID}` : "FREE",
        ]
          .join(" ")
          .toLowerCase()
          .includes(qq)
      );
    }

    return base;
  }, [devices, q, status]);

  const total = devices.length;
  const active = devices.filter((d) => String(d.STATUS).toUpperCase() === "ACTIVE").length;
  const inactive = devices.filter((d) => String(d.STATUS).toUpperCase() === "INACTIVE").length;
  const free = devices.filter((d) => !d.CAR_ID).length;

  return (
    <div className="grid gap-4">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="text-lg font-extrabold text-slate-100">IoT Devices</div>
            <div className="text-xs text-slate-400">
              {loading ? "Loading…" : `${filtered.length} devices`}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              className="h-10 w-[280px] rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100"
              placeholder="Search… (code, imei, firmware, car_id)"
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
              onClick={fetchDevices}
            >
              Refresh
            </button>

            {isSup && (
              <button
                className="h-10 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 px-3 text-sm font-extrabold text-white"
                onClick={() => setCreateOpen(true)}
              >
                + Register device
              </button>
            )}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total devices" value={total} />
        <StatCard label="Active" value={active} />
        <StatCard label="Inactive" value={inactive} />
        <StatCard label="Unassigned" value={free} />
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-auto rounded-2xl border border-slate-700/30 bg-slate-900/60">
        <table className="min-w-[980px] w-full">
          <thead>
            <tr className="text-xs text-slate-400">
              {["ID", "Code", "IMEI", "Firmware", "Status", "Assigned", "Last seen", "Created"].map((h) => (
                <th key={h} className="px-3 py-3 text-left">
                  {h}
                </th>
              ))}
              <th />
            </tr>
          </thead>

          <tbody>
            {!loading &&
              filtered.map((d) => (
                <tr key={d.DEVICE_ID} className="border-t border-slate-700/20 hover:bg-slate-700/10">
                  <td className="px-3 py-3 font-mono text-slate-100">#{d.DEVICE_ID}</td>
                  <td className="px-3 py-3 text-slate-100">{d.DEVICE_CODE}</td>
                  <td className="px-3 py-3 font-mono text-slate-100">{d.DEVICE_IMEI || "—"}</td>
                  <td className="px-3 py-3 text-slate-100">{d.FIRMWARE_VERSION || "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(d.STATUS)}`}>
                      {String(d.STATUS || "").toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {d.CAR_ID ? (
                      <span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                        CAR #{d.CAR_ID}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-sky-500/25 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-300">
                        FREE
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-400">{fmtDate(d.LAST_SEEN_AT)}</td>
                  <td className="px-3 py-3 text-slate-400">{fmtDate(d.CREATED_AT)}</td>
                  <td className="px-3 py-3">
                    <button
                      className="rounded-xl bg-slate-700/30 px-3 py-2 text-xs text-slate-100"
                      onClick={() => {
                        setSelected(d);
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
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  <div className="text-base font-bold">No devices found</div>
                  <div className="text-sm mt-1">
                    {isSup ? "Register a new IoT device to get started." : "No devices assigned to your branch yet."}
                  </div>
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAILS DRAWER */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-40 bg-black/50 flex justify-end">
          <div className="w-[460px] bg-slate-950 p-4">
            <div className="flex justify-between items-center">
              <div className="font-extrabold text-slate-100">Device #{selected.DEVICE_ID}</div>
              <button className="text-slate-400 hover:text-slate-100" onClick={() => setDrawerOpen(false)}>
                ✕
              </button>
            </div>

            <pre className="mt-4 text-xs text-slate-300">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {createOpen && isSup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-[520px] bg-slate-950 p-5 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold text-slate-100">Register IoT Device</div>
              <button className="text-slate-400 hover:text-slate-100" onClick={() => setCreateOpen(false)}>
                ✕
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Device Code (required)"
                value={form.DEVICE_CODE}
                onChange={(e) => setForm({ ...form, DEVICE_CODE: e.target.value })}
              />

              <input
                className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="IMEI (optional)"
                value={form.DEVICE_IMEI}
                onChange={(e) => setForm({ ...form, DEVICE_IMEI: e.target.value })}
              />

              <input
                className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                placeholder="Firmware version (optional)"
                value={form.FIRMWARE_VERSION}
                onChange={(e) => setForm({ ...form, FIRMWARE_VERSION: e.target.value })}
              />

              <select
                className="h-10 rounded-xl bg-slate-900 px-3 text-slate-100"
                value={form.STATUS}
                onChange={(e) => setForm({ ...form, STATUS: e.target.value })}
              >
                {["ACTIVE", "INACTIVE", "RETIRED"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <button className="h-10 rounded-xl bg-slate-800 px-4 text-slate-100" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>

                <button
                  className="h-10 rounded-xl bg-indigo-600 px-4 font-extrabold text-white disabled:opacity-60"
                  onClick={createDevice}
                  disabled={creating || !form.DEVICE_CODE.trim()}
                >
                  {creating ? "Saving..." : "Save"}
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Supervisor only — managers can’t register devices.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

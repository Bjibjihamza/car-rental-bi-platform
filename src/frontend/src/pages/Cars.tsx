import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

/* ================= TYPES ================= */

type CarRow = {
  CAR_ID: number;
  CATEGORY_ID: number;
  DEVICE_ID: number | null;
  VIN: string;
  LICENSE_PLATE: string;
  MAKE: string;
  MODEL: string;
  MODEL_YEAR: number;
  COLOR: string;
  ODOMETER_KM: number;
  STATUS: string;
  BRANCH_ID: number | null;
  CREATED_AT: string;
  BRANCH_CITY?: string | null;
};

/* ================= CONFIG ================= */

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

/* ================= HELPERS ================= */

function fmtKm(n: number) {
  return new Intl.NumberFormat().format(n) + " km";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function categoryLabel(categoryId: number) {
  switch (categoryId) {
    case 1:
      return "City";
    case 2:
      return "SUV";
    case 3:
      return "Luxury";
    case 4:
      return "Van";
    case 5:
      return "EV";
    default:
      return `#${categoryId}`;
  }
}

function statusBadgeClass(status: string) {
  const s = status.toUpperCase();
  if (s === "AVAILABLE") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (s === "RENTED") return "bg-blue-500/15 text-blue-300 border-blue-500/25";
  if (s === "MAINTENANCE") return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  if (s === "RETIRED") return "bg-slate-500/15 text-slate-300 border-slate-500/25";
  if (s === "RESERVED") return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25";
  return "bg-red-500/15 text-red-300 border-red-500/25";
}

type SortKey =
  | "CAR_ID"
  | "MAKE"
  | "MODEL"
  | "MODEL_YEAR"
  | "LICENSE_PLATE"
  | "ODOMETER_KM"
  | "STATUS"
  | "CREATED_AT";

/* ================= PAGE ================= */

export function CarsPage() {
  const { user, token } = useAuth();

  const [cars, setCars] = useState<CarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("CAR_ID");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [selected, setSelected] = useState<CarRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ================= FETCH ================= */

  async function fetchCars() {
    if (!user?.branchId) return;

    setLoading(true);
    setErr(null);

    try {
      const url = `${API_URL}/api/v1/cars?branchId=${user.branchId}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CarRow[];
      setCars(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load cars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.branchId]);

  /* ================= FILTERING ================= */

  const statusOptions = useMemo(
    () => Array.from(new Set(cars.map((c) => c.STATUS.toUpperCase()))),
    [cars]
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(cars.map((c) => c.CATEGORY_ID))),
    [cars]
  );

  const filtered = useMemo(() => {
    let base = cars.slice();
    const qq = q.trim().toLowerCase();

    if (status !== "ALL") base = base.filter((c) => c.STATUS === status);
    if (category !== "ALL") base = base.filter((c) => String(c.CATEGORY_ID) === category);

    if (qq) {
      base = base.filter((c) =>
        [
          c.MAKE,
          c.MODEL,
          c.VIN,
          c.LICENSE_PLATE,
          c.STATUS,
          categoryLabel(c.CATEGORY_ID),
        ]
          .join(" ")
          .toLowerCase()
          .includes(qq)
      );
    }

    base.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av: any = (a as any)[sortKey];
      const bv: any = (b as any)[sortKey];
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });

    return base;
  }, [cars, q, status, category, sortKey, sortDir]);

  /* ================= STATS ================= */

  const stats = useMemo(() => {
    const total = cars.length;
    const available = cars.filter((c) => c.STATUS === "AVAILABLE").length;
    const rented = cars.filter((c) => c.STATUS === "RENTED").length;
    const maintenance = cars.filter((c) => c.STATUS === "MAINTENANCE").length;
    return { total, available, rented, maintenance };
  }, [cars]);

  /* ================= UI ================= */

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="text-lg font-extrabold text-slate-100">Cars — My Branch</div>
            <div className="text-xs text-slate-400">
              {loading ? "Loading…" : `${filtered.length} cars`}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              className="h-10 w-[240px] rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select
              className="h-10 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ALL">All categories</option>
              {categoryOptions.map((id) => (
                <option key={id} value={String(id)}>
                  {categoryLabel(id)}
                </option>
              ))}
            </select>

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
              onClick={fetchCars}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-auto rounded-2xl border border-slate-700/30 bg-slate-900/60">
        <table className="min-w-[900px] w-full">
          <thead>
            <tr className="text-xs text-slate-400">
              {["ID", "Make", "Model", "Year", "Plate", "Category", "Status", "Odometer", "Created"].map(
                (h) => (
                  <th key={h} className="px-3 py-3 text-left">
                    {h}
                  </th>
                )
              )}
              <th />
            </tr>
          </thead>

          <tbody>
            {!loading &&
              filtered.map((c) => (
                <tr key={c.CAR_ID} className="border-t border-slate-700/20 hover:bg-slate-700/10">
                  <td className="px-3 py-3 font-mono text-slate-100">#{c.CAR_ID}</td>
                  <td className="px-3 py-3 text-slate-100">{c.MAKE}</td>
                  <td className="px-3 py-3 text-slate-100">{c.MODEL}</td>
                  <td className="px-3 py-3 text-slate-300">{c.MODEL_YEAR}</td>
                  <td className="px-3 py-3 font-mono text-slate-100">{c.LICENSE_PLATE}</td>
                  <td className="px-3 py-3 text-slate-100">{categoryLabel(c.CATEGORY_ID)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(
                        c.STATUS
                      )}`}
                    >
                      {c.STATUS}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-100">{fmtKm(c.ODOMETER_KM)}</td>
                  <td className="px-3 py-3 text-slate-400">{fmtDate(c.CREATED_AT)}</td>
                  <td className="px-3 py-3">
                    <button
                      className="rounded-xl bg-slate-700/30 px-3 py-2 text-xs text-slate-100"
                      onClick={() => {
                        setSelected(c);
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
                <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
                  No cars found for your branch
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DRAWER */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-40 bg-black/50 flex justify-end">
          <div className="w-[420px] bg-slate-950 p-4">
            <div className="flex justify-between items-center">
              <div className="font-extrabold text-slate-100">
                {selected.MAKE} {selected.MODEL}
              </div>
              <button
                className="text-slate-400 hover:text-slate-100"
                onClick={() => setDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            <pre className="mt-4 text-xs text-slate-300">
              {JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

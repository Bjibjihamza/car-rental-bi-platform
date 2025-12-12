import { useEffect, useMemo, useState } from "react";

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

const API_URL =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

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
  | "BRANCH_CITY"
  | "CREATED_AT";

export function CarsPage() {
  const [cars, setCars] = useState<CarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("CAR_ID");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [selected, setSelected] = useState<CarRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function fetchCars() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/cars`, { headers: { Accept: "application/json" } });
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
  }, []);

  const branchOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of cars) {
      const city = (c.BRANCH_CITY ?? "").trim();
      if (city) set.set(city, city);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [cars]);

  const statusOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of cars) {
      const s = (c.STATUS ?? "").toUpperCase();
      if (s) set.set(s, s);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [cars]);

  const categoryOptions = useMemo(() => {
    const set = new Map<number, number>();
    for (const c of cars) set.set(c.CATEGORY_ID, c.CATEGORY_ID);
    return Array.from(set.values()).sort((a, b) => a - b);
  }, [cars]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let base = cars.slice();

    if (branch !== "ALL") base = base.filter((c) => (c.BRANCH_CITY ?? "") === branch);
    if (status !== "ALL") base = base.filter((c) => (c.STATUS ?? "").toUpperCase() === status);
    if (category !== "ALL") base = base.filter((c) => String(c.CATEGORY_ID) === category);

    if (qq) {
      base = base.filter((c) => {
        const hay = [
          c.CAR_ID,
          c.MAKE,
          c.MODEL,
          c.VIN,
          c.LICENSE_PLATE,
          c.COLOR,
          c.STATUS,
          c.BRANCH_CITY ?? "",
          categoryLabel(c.CATEGORY_ID),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(qq);
      });
    }

    base.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av: any = (a as any)[sortKey];
      const bv: any = (b as any)[sortKey];

      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;

      if (sortKey === "CREATED_AT") {
        const ta = new Date(av ?? "").getTime();
        const tb = new Date(bv ?? "").getTime();
        return ((ta || 0) - (tb || 0)) * dir;
      }

      return String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true }) * dir;
    });

    return base;
  }, [cars, q, branch, status, category, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = cars.length;
    const available = cars.filter((c) => (c.STATUS ?? "").toUpperCase() === "AVAILABLE").length;
    const rented = cars.filter((c) => (c.STATUS ?? "").toUpperCase() === "RENTED").length;
    const maintenance = cars.filter((c) => (c.STATUS ?? "").toUpperCase() === "MAINTENANCE").length;
    return { total, available, rented, maintenance };
  }, [cars]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openDetails(c: CarRow) {
    setSelected(c);
    setDrawerOpen(true);
  }

  function closeDetails() {
    setDrawerOpen(false);
    setTimeout(() => setSelected(null), 150);
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 shadow-[0_10px_40px_rgba(0,0,0,0.28)] backdrop-blur">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-700/30 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-extrabold tracking-tight text-slate-100">Cars</div>
            <div className="mt-1 text-xs text-slate-400">
              {loading ? "Loading fleet…" : `${filtered.length} result(s) • ${stats.total} total`}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              className="h-10 w-[240px] rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/20"
              placeholder="Search make, model, plate, VIN, city…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select
              className="h-10 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100 outline-none focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/20"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="ALL">All cities</option>
              {branchOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100 outline-none focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/20"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ALL">All categories</option>
              {categoryOptions.map((id) => (
                <option key={id} value={String(id)}>
                  {categoryLabel(id)} (#{id})
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100 outline-none focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/20"
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
              className="h-10 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100 hover:border-slate-600/60 hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => fetchCars()}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            <button
              className="h-10 rounded-xl border border-indigo-400/60 bg-indigo-500/20 px-3 text-sm font-semibold text-slate-100 hover:bg-indigo-500/30"
              onClick={() => alert("TODO: Add Car form")}
            >
              + Add Car
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-700/30 bg-slate-950/30 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total</div>
            <div className="mt-1 text-xl font-extrabold text-slate-100">{loading ? "—" : stats.total}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/30 bg-slate-950/30 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Available</div>
            <div className="mt-1 text-xl font-extrabold text-slate-100">{loading ? "—" : stats.available}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/30 bg-slate-950/30 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Rented</div>
            <div className="mt-1 text-xl font-extrabold text-slate-100">{loading ? "—" : stats.rented}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/30 bg-slate-950/30 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Maintenance</div>
            <div className="mt-1 text-xl font-extrabold text-slate-100">{loading ? "—" : stats.maintenance}</div>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="px-4 pb-3">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
              <b>Failed to load cars:</b> {err}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-auto rounded-2xl">
          <table className="min-w-[980px] w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900/90 backdrop-blur">
                {[
                  ["CAR_ID", "ID"],
                  ["MAKE", "Make"],
                  ["MODEL", "Model"],
                  ["MODEL_YEAR", "Year"],
                  ["LICENSE_PLATE", "Plate"],
                  ["CATEGORY_ID", "Category"],
                  ["BRANCH_CITY", "City"],
                  ["DEVICE_ID", "Device"],
                  ["STATUS", "Status"],
                  ["ODOMETER_KM", "Odometer"],
                  ["CREATED_AT", "Created"],
                ].map(([key, label]) => {
                  const sortable = key !== "CATEGORY_ID" && key !== "DEVICE_ID";
                  const k = key as SortKey;
                  return (
                    <th
                      key={key}
                      onClick={sortable ? () => toggleSort(k) : undefined}
                      className={[
                        "border-b border-slate-700/30 px-3 py-3 text-left text-xs font-semibold text-slate-400",
                        sortable ? "cursor-pointer select-none hover:text-slate-200" : "",
                      ].join(" ")}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortable && sortKey === k && (
                          <span className="text-[11px] opacity-80">{sortDir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </span>
                    </th>
                  );
                })}
                <th className="border-b border-slate-700/30 px-3 py-3 text-left text-xs font-semibold text-slate-400">
                  {/* actions */}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-slate-700/20">
                    {Array.from({ length: 12 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-3 w-[70%] animate-pulse rounded-lg bg-slate-700/25" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-6 text-sm text-slate-400">
                    No cars found. Try clearing filters or search.
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((c) => (
                  <tr key={c.CAR_ID} className="border-b border-slate-700/15 hover:bg-slate-700/10">
                    <td className="px-3 py-3 font-mono text-slate-100">#{c.CAR_ID}</td>
                    <td className="px-3 py-3 text-slate-100">{c.MAKE}</td>
                    <td className="px-3 py-3 text-slate-100">{c.MODEL}</td>
                    <td className="px-3 py-3 text-slate-300">{c.MODEL_YEAR}</td>
                    <td className="px-3 py-3 font-mono text-slate-100">{c.LICENSE_PLATE}</td>

                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/35 bg-slate-950/30 px-3 py-1 text-xs text-slate-100">
                        <span className="h-2 w-2 rounded-full bg-slate-300/70" />
                        {categoryLabel(c.CATEGORY_ID)}
                        <span className="text-slate-400">#{c.CATEGORY_ID}</span>
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-100">{c.BRANCH_CITY ?? "—"}</td>

                    <td className="px-3 py-3 text-slate-300">
                      {c.DEVICE_ID ? <span className="font-mono">#{c.DEVICE_ID}</span> : "—"}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold",
                          statusBadgeClass(c.STATUS),
                        ].join(" ")}
                      >
                        {c.STATUS.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-100">{fmtKm(c.ODOMETER_KM)}</td>
                    <td className="px-3 py-3 text-slate-400">{fmtDate(c.CREATED_AT)}</td>

                    <td className="px-3 py-3">
                      <button
                        className="h-9 rounded-xl border border-transparent bg-transparent px-3 text-sm text-slate-100 hover:border-slate-700/40 hover:bg-slate-700/10"
                        onClick={() => openDetails(c)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetails();
          }}
        >
          <div className="h-full w-[min(520px,92vw)] border-l border-slate-700/40 bg-slate-950/80 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-extrabold text-slate-100">
                  {selected ? `${selected.MAKE} ${selected.MODEL}` : "Car details"}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {selected ? (
                    <>
                      <span className="font-mono">#{selected.CAR_ID}</span> •{" "}
                      <span className="font-mono">{selected.LICENSE_PLATE}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <button
                className="h-10 rounded-xl border border-transparent bg-transparent px-3 text-slate-100 hover:border-slate-700/40 hover:bg-slate-700/10"
                onClick={closeDetails}
              >
                ✕
              </button>
            </div>

            {selected && (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/35 bg-slate-950/30 px-3 py-1 text-xs text-slate-100">
                    <span className="h-2 w-2 rounded-full bg-slate-300/70" />
                    {categoryLabel(selected.CATEGORY_ID)} <span className="text-slate-400">#{selected.CATEGORY_ID}</span>
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/35 bg-slate-950/30 px-3 py-1 text-xs text-slate-100">
                    <span className="h-2 w-2 rounded-full bg-slate-300/70" />
                    City: <b className="ml-1">{selected.BRANCH_CITY ?? "—"}</b>
                  </span>

                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold",
                      statusBadgeClass(selected.STATUS),
                    ].join(" ")}
                  >
                    {selected.STATUS.toUpperCase()}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    ["VIN", <span className="font-mono">{selected.VIN}</span>],
                    ["Plate", <span className="font-mono">{selected.LICENSE_PLATE}</span>],
                    ["Year", selected.MODEL_YEAR],
                    ["Color", selected.COLOR || "—"],
                    ["Odometer", fmtKm(selected.ODOMETER_KM)],
                    ["Device ID", selected.DEVICE_ID ? <span className="font-mono">#{selected.DEVICE_ID}</span> : "—"],
                    ["Branch ID", selected.BRANCH_ID ?? "—"],
                    ["Created at", fmtDate(selected.CREATED_AT)],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="rounded-2xl border border-slate-700/30 bg-slate-900/60 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{k}</div>
                      <div className="mt-2 text-sm text-slate-100 break-words">{v as any}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    className="h-10 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 text-sm text-slate-100 hover:border-slate-600/60 hover:bg-slate-950/60"
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(selected, null, 2));
                      alert("Copied car JSON to clipboard");
                    }}
                  >
                    Copy JSON
                  </button>
                  <button
                    className="h-10 rounded-xl border border-indigo-400/60 bg-indigo-500/20 px-3 text-sm font-semibold text-slate-100 hover:bg-indigo-500/30"
                    onClick={() => alert("TODO: Edit Car form")}
                  >
                    Edit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

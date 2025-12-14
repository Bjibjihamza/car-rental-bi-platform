// src/frontend/src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { GlassCard } from "../components/GlassCard";
import { Link } from "react-router-dom";
import {
  Car as CarIcon,
  Activity,
  Wrench,
  DollarSign,
  MapPin,
  RefreshCw,
  ExternalLink,
  Gauge,
  Fuel,
  Thermometer,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Cell,
} from "recharts";

/* ================= TYPES (minimal) ================= */
type CarRow = {
  CAR_ID: number;
  LICENSE_PLATE?: string | null;
  MAKE?: string | null;
  MODEL?: string | null;
  STATUS?: string | null; // AVAILABLE | RENTED | MAINTENANCE ...
  BRANCH_ID?: number | null;
  BRANCH_CITY?: string | null;
  CREATED_AT?: string | null;
};

type RentalRow = {
  RENTAL_ID: number;
  CAR_ID: number;
  BRANCH_ID: number;
  START_AT: string;
  DUE_AT: string;
  RETURN_AT: string | null;
  STATUS: string; // ACTIVE | IN_PROGRESS | CLOSED | CANCELLED
  TOTAL_AMOUNT: number | null;
  CURRENCY: string | null;

  MAKE?: string | null;
  MODEL?: string | null;
  LICENSE_PLATE?: string | null;
  CUSTOMER_FIRST_NAME?: string | null;
  CUSTOMER_LAST_NAME?: string | null;
  BRANCH_CITY?: string | null;
  IS_DRIVING?: number; // 1/0 (from your rentals query)
};

type LiveTelemetryRow = {
  DEVICE_ID: number;
  CAR_ID: number;
  LICENSE_PLATE?: string | null;
  MAKE?: string | null;
  MODEL?: string | null;
  SPEED_KMH?: number | null;
  FUEL_LEVEL_PCT?: number | null;
  ENGINE_TEMP_C?: number | null;
  LATITUDE?: number | null;
  LONGITUDE?: number | null;
  EVENT_TYPE?: string | null;
  RECEIVED_AT: string;
};

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

/* ================= HELPERS ================= */
function fmtDateShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function money(amount: number | null, cur: string | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur || "MAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function mapsUrl(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function statusPill(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "AVAILABLE")
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (s === "RENTED")
    return "bg-indigo-500/10 text-indigo-300 border-indigo-500/20";
  if (s === "MAINTENANCE")
    return "bg-orange-500/10 text-orange-300 border-orange-500/20";
  return "bg-white/5 text-neutral-300 border-white/10";
}

/* ================= PAGE ================= */
export function DashboardPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  const [cars, setCars] = useState<CarRow[]>([]);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [live, setLive] = useState<LiveTelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    setErr(null);
    setLoading(true);

    const headers = {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const [carsRes, rentalsRes, liveRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/cars`, { headers }),
        fetch(`${API_URL}/api/v1/rentals`, { headers }),
        fetch(`${API_URL}/api/v1/iot-telemetry/live`, { headers }),
      ]);

      const [carsData, rentalsData, liveData] = await Promise.all([
        carsRes.json(),
        rentalsRes.json(),
        liveRes.json(),
      ]);

      if (!carsRes.ok) throw new Error(carsData?.message || `Cars HTTP ${carsRes.status}`);
      if (!rentalsRes.ok) throw new Error(rentalsData?.message || `Rentals HTTP ${rentalsRes.status}`);
      if (!liveRes.ok) throw new Error(liveData?.message || `Live HTTP ${liveRes.status}`);

      setCars(Array.isArray(carsData) ? carsData : []);
      setRentals(Array.isArray(rentalsData) ? rentalsData : []);
      setLive(Array.isArray(liveData) ? liveData : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 8000); // dashboard refresh
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.branchId, token]);

  /* ================= DERIVED METRICS ================= */
  const metrics = useMemo(() => {
    const totalFleet = cars.length;

    const available = cars.filter((c) => String(c.STATUS).toUpperCase() === "AVAILABLE").length;
    const rented = cars.filter((c) => String(c.STATUS).toUpperCase() === "RENTED").length;
    const maintenance = cars.filter((c) => String(c.STATUS).toUpperCase() === "MAINTENANCE").length;

    // "On Road": based on rentals query flag IS_DRIVING = 1
    const onRoad = rentals.filter(
      (r) =>
        r.IS_DRIVING === 1 &&
        !["CLOSED", "CANCELLED"].includes(String(r.STATUS).toUpperCase())
    ).length;

    // Revenue: sum of rentals total amounts (all time loaded)
    const revenue = rentals.reduce((sum, r) => sum + (Number(r.TOTAL_AMOUNT) || 0), 0);

    // Active rentals count
    const activeRentals = rentals.filter((r) =>
      ["ACTIVE", "IN_PROGRESS"].includes(String(r.STATUS).toUpperCase())
    ).length;

    return {
      totalFleet,
      available,
      rented,
      maintenance,
      onRoad,
      activeRentals,
      revenue,
    };
  }, [cars, rentals]);

  /* ================= CHART (last 7 days rentals created) ================= */
  const chartData = useMemo(() => {
    // build last 7 days buckets
    const days: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      days.push({ key, label, count: 0 });
    }

    // we don't have CREATED_AT in RentalRow typed above, but your backend returns CREATED_AT
    // so we read it dynamically if present.
    for (const r of rentals as any[]) {
      const created = r.CREATED_AT ? String(r.CREATED_AT) : null;
      if (!created) continue;
      const key = new Date(created).toISOString().slice(0, 10);
      const idx = days.findIndex((x) => x.key === key);
      if (idx >= 0) days[idx].count += 1;
    }

    return days.map((d) => ({ type: d.label, count: d.count }));
  }, [rentals]);

  /* ================= TOP PERFORMER (simple) ================= */
  const topCar = useMemo(() => {
    // pick car with most rentals in loaded data
    const map = new Map<number, number>();
    rentals.forEach((r) => map.set(r.CAR_ID, (map.get(r.CAR_ID) || 0) + 1));
    let bestId: number | null = null;
    let best = -1;
    for (const [id, n] of map.entries()) {
      if (n > best) {
        best = n;
        bestId = id;
      }
    }
    const found = cars.find((c) => c.CAR_ID === bestId) || null;
    return { car: found, count: best };
  }, [cars, rentals]);

  /* ================= LIVE LIST (from rentals driving OR live feed) ================= */
  const liveList = useMemo(() => {
    // prefer rentals with IS_DRIVING=1 (gives customer name + rental id)
    const drivingRentals = rentals
      .filter(
        (r) =>
          r.IS_DRIVING === 1 &&
          !["CLOSED", "CANCELLED"].includes(String(r.STATUS).toUpperCase())
      )
      .slice(0, 6);

    if (drivingRentals.length > 0) return { mode: "rentals" as const, items: drivingRentals };

    // fallback to live telemetry rows
    return { mode: "live" as const, items: live.slice(0, 6) };
  }, [rentals, live]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Hello, {user?.firstName || "Hamza"} 👋
          </h1>
          <p className="text-neutral-400">
            Fleet overview {isSup ? "(Supervisor)" : "(Manager)"} • {fmtDateShort(new Date().toISOString())}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadAll}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 inline-flex items-center gap-2"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </button>

          <Link
            to="/rentals"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            Open Rentals
          </Link>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* HERO */}
        <div className="lg:col-span-8">
          <GlassCard className="relative overflow-hidden !p-0">
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F14] via-[#0B0F14]/80 to-transparent z-10" />
            <img
              src="https://images.unsplash.com/photo-1617788138017-80ad40651399?q=80&w=1400&auto=format&fit=crop"
              alt="Fleet hero"
              className="absolute right-0 top-0 h-full w-2/3 object-cover opacity-60 z-0"
            />

            <div className="relative z-20 p-8">
              <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
                      DASHBOARD OVERVIEW
                    </div>
                    <h2 className="text-4xl font-bold text-white">
                      {topCar.car?.MAKE ? `${topCar.car.MAKE} ${topCar.car.MODEL}` : "Top Vehicle"}
                    </h2>
                    <p className="text-lg text-neutral-400">
                      {topCar.car?.LICENSE_PLATE ? `Plate: ${topCar.car.LICENSE_PLATE}` : "Based on rental activity"}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <CalendarDays className="h-4 w-4 text-neutral-400" />
                    <div className="text-xs text-neutral-400">
                      <div className="font-bold text-white">{metrics.activeRentals}</div>
                      Active rentals
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MiniKPI
                    icon={CarIcon}
                    label="Fleet"
                    value={String(metrics.totalFleet)}
                    sub={`${metrics.available} available`}
                  />
                  <MiniKPI
                    icon={Activity}
                    label="On Road"
                    value={String(metrics.onRoad)}
                    sub="Live (2 min)"
                    accent="text-indigo-300"
                  />
                  <MiniKPI
                    icon={Wrench}
                    label="Maintenance"
                    value={String(metrics.maintenance)}
                    sub="Needs attention"
                    accent="text-orange-300"
                  />
                  <MiniKPI
                    icon={DollarSign}
                    label="Revenue"
                    value={money(metrics.revenue, "MAD")}
                    sub="From rentals"
                    accent="text-emerald-300"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/cars"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition"
                  >
                    Manage Cars
                  </Link>
                  <Link
                    to="/devices"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition"
                  >
                    Manage Devices
                  </Link>
                  <Link
                    to="/live"
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition"
                  >
                    Live Monitor
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* RIGHT STATS */}
        <div className="lg:col-span-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Available" value={metrics.available} />
            <StatCard label="Rented" value={metrics.rented} accent="text-indigo-300" />
            <StatCard label="Active Rentals" value={metrics.activeRentals} accent="text-emerald-300" />
            <StatCard
              label="Revenue"
              value={money(metrics.revenue, "MAD")}
              solid
            />
          </div>

          <div className="rounded-[24px] border border-white/5 bg-[#18181b] p-4 flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/5">
              <MapPin className="h-5 w-5 text-neutral-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {user?.branchId ? `Branch #${user.branchId}` : "All Branches"}
              </div>
              <div className="text-xs text-neutral-500">
                {isSup ? "Supervisor scope" : "Manager scope"}
              </div>
            </div>
          </div>
        </div>

        {/* CHART */}
        <div className="lg:col-span-8">
          <GlassCard title="Rentals (Last 7 Days)">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={22}>
                  <XAxis
                    dataKey="type"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#737373", fontSize: 12 }}
                    dy={10}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #333",
                      borderRadius: "10px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 8, 8]}>
                    {chartData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i % 2 === 0 ? "#6366f1" : "#818cf8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* LIVE STATUS */}
        <div className="lg:col-span-4">
          <GlassCard title="Live Status" className="h-full">
            <div className="space-y-3">
              {liveList.items.length === 0 ? (
                <div className="text-sm text-neutral-400">
                  No live activity right now.
                </div>
              ) : liveList.mode === "rentals" ? (
                (liveList.items as RentalRow[]).map((r) => (
                  <div
                    key={r.RENTAL_ID}
                    className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 font-bold">
                        {(r.LICENSE_PLATE?.[0] || "C").toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          {r.LICENSE_PLATE || `Car #${r.CAR_ID}`}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {r.CUSTOMER_FIRST_NAME} {r.CUSTOMER_LAST_NAME}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-300">
                        DRIVING
                      </div>
                      <Link
                        to={`/rentals/${r.RENTAL_ID}/report`}
                        className="text-neutral-400 hover:text-white"
                        title="Open rental report"
                      >
                        <ExternalLink size={16} />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                (liveList.items as LiveTelemetryRow[]).map((p) => (
                  <div
                    key={`${p.CAR_ID}-${p.RECEIVED_AT}`}
                    className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 font-bold">
                        {(p.LICENSE_PLATE?.[0] || "L").toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          {p.LICENSE_PLATE || `Car #${p.CAR_ID}`}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {fmtDateShort(p.RECEIVED_AT)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-300">
                      LIVE
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* small live stats */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <TinyStat icon={Gauge} label="Speed" value={live?.[0]?.SPEED_KMH == null ? "—" : `${live[0].SPEED_KMH}`} />
              <TinyStat icon={Fuel} label="Fuel" value={live?.[0]?.FUEL_LEVEL_PCT == null ? "—" : `${live[0].FUEL_LEVEL_PCT}%`} />
              <TinyStat icon={Thermometer} label="Temp" value={live?.[0]?.ENGINE_TEMP_C == null ? "—" : `${live[0].ENGINE_TEMP_C}°`} />
            </div>

            {/* maps shortcut */}
            {live?.[0] && mapsUrl(live[0].LATITUDE, live[0].LONGITUDE) && (
              <a
                href={mapsUrl(live[0].LATITUDE, live[0].LONGITUDE)!}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10 transition"
              >
                <MapPin size={14} />
                Open Latest GPS
              </a>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

/* ================= UI COMPONENTS ================= */
function StatCard({
  label,
  value,
  accent,
  solid,
}: {
  label: string;
  value: any;
  accent?: string;
  solid?: boolean;
}) {
  return (
    <div
      className={
        solid
          ? "rounded-[24px] bg-[#6366F1] p-5 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)]"
          : "rounded-[24px] border border-white/5 bg-[#18181b] p-5"
      }
    >
      <div className={solid ? "text-sm text-indigo-100" : "text-sm text-neutral-500"}>
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${solid ? "text-white" : accent || "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function MiniKPI({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400">{label}</div>
        <Icon className="h-4 w-4 text-neutral-500" />
      </div>
      <div className={`mt-1 text-lg font-bold ${accent || "text-white"}`}>{value}</div>
      <div className="mt-1 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

function TinyStat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-neutral-500">{label}</div>
        <Icon className="h-4 w-4 text-neutral-500" />
      </div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

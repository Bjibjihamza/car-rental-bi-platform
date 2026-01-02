import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { Activity, Zap, Thermometer, Navigation, Flame, Fuel, X, MapPin } from "lucide-react";

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

/** ---------------- TYPES ---------------- */
type LiveSignal = {
  DEVICE_ID: number;
  CAR_ID: number;
  MAKE: string;
  MODEL: string;
  LICENSE_PLATE: string;
  SPEED_KMH: number;
  FUEL_LEVEL_PCT: number;
  ENGINE_TEMP_C: number;
  EVENT_TYPE: string;
  LATITUDE: number;
  LONGITUDE: number;
  RECEIVED_AT: string;
};

type Filters = {
  q: string;
  event: "ALL" | "DRIVING" | "IDLE" | "STOPPED";
  onlyRisk: boolean;
  onlyFuelLow: boolean;
  onlyOverheat: boolean;
  onlySpeeding: boolean;
};

/** ---------------- CONSTANTS ---------------- */
const SPEEDING_KMH = 120;
const OVERHEAT_C = 110;
const FUEL_LOW_PCT = 15;

const defaultFilters: Filters = {
  q: "",
  event: "ALL",
  onlyRisk: false,
  onlyFuelLow: false,
  onlyOverheat: false,
  onlySpeeding: false,
};

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Supports both:
 * - object rows (recommended)
 * - array rows (fallback)
 */
function normalizeSignal(row: any): LiveSignal | null {
  if (!row) return null;

  // object shape
  if (typeof row === "object" && !Array.isArray(row)) {
    const out: LiveSignal = {
      DEVICE_ID: Number(row.DEVICE_ID),
      CAR_ID: Number(row.CAR_ID),
      MAKE: String(row.MAKE ?? ""),
      MODEL: String(row.MODEL ?? ""),
      LICENSE_PLATE: String(row.LICENSE_PLATE ?? ""),
      SPEED_KMH: safeNum(row.SPEED_KMH),
      FUEL_LEVEL_PCT: safeNum(row.FUEL_LEVEL_PCT),
      ENGINE_TEMP_C: safeNum(row.ENGINE_TEMP_C),
      EVENT_TYPE: String(row.EVENT_TYPE ?? "UNKNOWN"),
      LATITUDE: safeNum(row.LATITUDE),
      LONGITUDE: safeNum(row.LONGITUDE),
      RECEIVED_AT: String(row.RECEIVED_AT ?? new Date().toISOString()),
    };
    return out;
  }

  // array fallback: [DEVICE_ID, CAR_ID, MAKE, MODEL, LICENSE_PLATE, SPEED, FUEL, TEMP, EVENT, LAT, LNG, RECEIVED_AT]
  if (Array.isArray(row)) {
    const out: LiveSignal = {
      DEVICE_ID: Number(row[0]),
      CAR_ID: Number(row[1]),
      MAKE: String(row[2] ?? ""),
      MODEL: String(row[3] ?? ""),
      LICENSE_PLATE: String(row[4] ?? ""),
      SPEED_KMH: safeNum(row[5]),
      FUEL_LEVEL_PCT: safeNum(row[6]),
      ENGINE_TEMP_C: safeNum(row[7]),
      EVENT_TYPE: String(row[8] ?? "UNKNOWN"),
      LATITUDE: safeNum(row[9]),
      LONGITUDE: safeNum(row[10]),
      RECEIVED_AT: String(row[11] ?? new Date().toISOString()),
    };
    return out;
  }

  return null;
}

function eventTone(ev: string) {
  const t = String(ev || "").toUpperCase();
  if (t === "DRIVING") return "blue";
  if (t === "IDLE") return "amber";
  if (t === "STOPPED") return "gray";
  return "gray";
}

function riskScore(s: LiveSignal) {
  let score = 0;
  if (s.ENGINE_TEMP_C >= OVERHEAT_C) score += 3;
  if (s.SPEED_KMH >= SPEEDING_KMH) score += 2;
  if (s.FUEL_LEVEL_PCT <= FUEL_LOW_PCT) score += 2;
  if (String(s.EVENT_TYPE).toUpperCase() === "IDLE") score += 1;
  return score;
}

function statusPill(s: LiveSignal) {
  const over = s.ENGINE_TEMP_C >= OVERHEAT_C;
  const spd = s.SPEED_KMH >= SPEEDING_KMH;
  const low = s.FUEL_LEVEL_PCT <= FUEL_LOW_PCT;

  if (over)
    return {
      label: "OVERHEAT",
      cls: "bg-rose-500/15 text-rose-300 border-rose-500/20",
    };
  if (spd)
    return {
      label: "SPEEDING",
      cls: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    };
  if (low)
    return {
      label: "FUEL LOW",
      cls: "bg-orange-500/15 text-orange-300 border-orange-500/20",
    };
  return {
    label: "OK",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  };
}

function kpiBox({
  icon: Icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "green" | "blue" | "orange" | "rose" | "neutral";
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/20 text-blue-400",
    orange: "bg-orange-500/20 text-orange-400",
    rose: "bg-rose-500/20 text-rose-400",
    neutral: "bg-white/5 text-neutral-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${tones[tone]}`}>
        <Icon size={24} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-neutral-400">{label}</p>
        <h3 className="text-2xl font-bold text-white truncate">{value}</h3>
        {sub && <p className="text-xs text-neutral-500 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/** ---------------- PAGE ---------------- */
export function LiveMonitor() {
  const { token } = useAuth();

  const [rawSignals, setRawSignals] = useState<LiveSignal[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  // drawer selection
  const [selected, setSelected] = useState<LiveSignal | null>(null);

  // polling
  useEffect(() => {
    let alive = true;

    async function fetchLive() {
      try {
        const t = token || localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/v1/iot-telemetry/live`, {
          headers: {
            Accept: "application/json",
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
        });

        const json = await res.json();
        if (!res.ok) return;

        const arr = Array.isArray(json) ? json : [];
        const normalized = arr.map(normalizeSignal).filter(Boolean) as LiveSignal[];

        if (alive) {
          setRawSignals(normalized);
          setLastUpdate(new Date());
        }
      } catch (e) {
        console.error(e);
      }
    }

    fetchLive();
    const it = setInterval(fetchLive, 3000);
    return () => {
      alive = false;
      clearInterval(it);
    };
  }, [token]);

  // latest point per car (for KPI + table)
  const latestByCar = useMemo(() => {
    const m = new Map<number, LiveSignal>();
    for (const s of rawSignals) {
      const prev = m.get(s.CAR_ID);
      if (
        !prev ||
        new Date(s.RECEIVED_AT).getTime() > new Date(prev.RECEIVED_AT).getTime()
      ) {
        m.set(s.CAR_ID, s);
      }
    }
    return Array.from(m.values());
  }, [rawSignals]);

  // KPIs
  const kpis = useMemo(() => {
    const activeCars = latestByCar.length;

    const avgSpeed =
      activeCars > 0
        ? (
            latestByCar.reduce((acc, s) => acc + (s.SPEED_KMH || 0), 0) /
            activeCars
          ).toFixed(1)
        : "0.0";

    const maxSpeed =
      activeCars > 0
        ? Math.max(...latestByCar.map((s) => s.SPEED_KMH || 0)).toFixed(0)
        : "0";

    const fuelLow = latestByCar.filter((s) => s.FUEL_LEVEL_PCT <= FUEL_LOW_PCT).length;
    const overheat = latestByCar.filter((s) => s.ENGINE_TEMP_C >= OVERHEAT_C).length;
    const speeding = latestByCar.filter((s) => s.SPEED_KMH >= SPEEDING_KMH).length;

    return { activeCars, avgSpeed, maxSpeed, fuelLow, overheat, speeding };
  }, [latestByCar]);

  // filtered table rows
  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return latestByCar
      .filter((s) => {
        if (filters.event !== "ALL" && String(s.EVENT_TYPE).toUpperCase() !== filters.event)
          return false;

        if (filters.onlyFuelLow && !(s.FUEL_LEVEL_PCT <= FUEL_LOW_PCT)) return false;
        if (filters.onlyOverheat && !(s.ENGINE_TEMP_C >= OVERHEAT_C)) return false;
        if (filters.onlySpeeding && !(s.SPEED_KMH >= SPEEDING_KMH)) return false;
        if (filters.onlyRisk && riskScore(s) === 0) return false;

        if (q) {
          const hay = `${s.LICENSE_PLATE} ${s.MAKE} ${s.MODEL}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => riskScore(b) - riskScore(a));
  }, [latestByCar, filters]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiBox({
          icon: Activity,
          label: "Signals (latest batch)",
          value: rawSignals.length,
          sub: `Updated: ${lastUpdate.toLocaleTimeString()}`,
          tone: "neutral",
        })}
        {kpiBox({ icon: Navigation, label: "Active Vehicles", value: kpis.activeCars, tone: "blue" })}
        {kpiBox({ icon: Zap, label: "Avg Speed", value: `${kpis.avgSpeed} km/h`, tone: "orange" })}
        {kpiBox({ icon: Zap, label: "Max Speed", value: `${kpis.maxSpeed} km/h`, tone: "orange" })}
        {kpiBox({ icon: Fuel, label: "Fuel Low", value: kpis.fuelLow, tone: "orange" })}
        {kpiBox({ icon: Flame, label: "Overheats", value: kpis.overheat, tone: "rose" })}
      </div>

      {/* MAIN: FULL-WIDTH TABLE */}
      <Card
        title="Live Fleet Monitor"
        subtitle="Sorted by risk score — click a row to inspect"
        className="min-h-[640px]"
      >
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 gap-3">
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search plate / make / model..."
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-indigo-500/40"
          />

          <div className="flex flex-wrap gap-2">
            {(["ALL", "DRIVING", "IDLE", "STOPPED"] as const).map((ev) => (
              <button
                key={ev}
                onClick={() => setFilters((f) => ({ ...f, event: ev }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  filters.event === ev
                    ? "bg-indigo-600 text-white border-indigo-500/40"
                    : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"
                }`}
              >
                {ev}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <ToggleChip
              label="Only Risk"
              active={filters.onlyRisk}
              onClick={() => setFilters((f) => ({ ...f, onlyRisk: !f.onlyRisk }))}
            />
            <ToggleChip
              label="Fuel Low"
              active={filters.onlyFuelLow}
              onClick={() => setFilters((f) => ({ ...f, onlyFuelLow: !f.onlyFuelLow }))}
            />
            <ToggleChip
              label="Overheat"
              active={filters.onlyOverheat}
              onClick={() => setFilters((f) => ({ ...f, onlyOverheat: !f.onlyOverheat }))}
            />
            <ToggleChip
              label="Speeding"
              active={filters.onlySpeeding}
              onClick={() => setFilters((f) => ({ ...f, onlySpeeding: !f.onlySpeeding }))}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden">
          <DataTable
            rows={filtered}
            cols={[
              {
                key: "STATUS",
                header: "Status",
                render: (r: LiveSignal) => {
                  const pill = statusPill(r);
                  return (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${pill.cls}`}
                    >
                      {pill.label}
                    </span>
                  );
                },
              },
              {
                key: "RISK",
                header: "Risk",
                render: (r: LiveSignal) => (
                  <span className="font-mono text-xs font-bold text-white">{riskScore(r)}</span>
                ),
              },
              {
                key: "CAR",
                header: "Vehicle",
                render: (r: LiveSignal) => (
                  <button onClick={() => setSelected(r)} className="text-left group">
                    <div className="font-bold text-white text-sm group-hover:text-indigo-300">
                      {r.LICENSE_PLATE}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {r.MAKE} {r.MODEL}
                    </div>
                  </button>
                ),
              },
              {
                key: "EVENT",
                header: "Event",
                render: (r: LiveSignal) => (
                  <Badge tone={eventTone(r.EVENT_TYPE)}>
                    {String(r.EVENT_TYPE || "").toUpperCase()}
                  </Badge>
                ),
              },
              {
                key: "SPEED",
                header: "Speed",
                render: (r: LiveSignal) => (
                  <span
                    className={`font-mono font-bold ${
                      r.SPEED_KMH >= SPEEDING_KMH ? "text-amber-300" : "text-white"
                    }`}
                  >
                    {r.SPEED_KMH.toFixed(0)} km/h
                  </span>
                ),
              },
              {
                key: "FUEL",
                header: "Fuel",
                render: (r: LiveSignal) => (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          r.FUEL_LEVEL_PCT <= FUEL_LOW_PCT ? "bg-orange-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, r.FUEL_LEVEL_PCT))}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-400">{r.FUEL_LEVEL_PCT.toFixed(0)}%</span>
                  </div>
                ),
              },
              {
                key: "TEMP",
                header: "Temp",
                render: (r: LiveSignal) => (
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${
                      r.ENGINE_TEMP_C >= OVERHEAT_C ? "text-rose-300" : "text-neutral-300"
                    }`}
                  >
                    <Thermometer size={12} /> {r.ENGINE_TEMP_C.toFixed(0)}°C
                  </span>
                ),
              },
              {
                key: "LOC",
                header: "Location",
                render: (r: LiveSignal) =>
                  r.LATITUDE && r.LONGITUDE ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${r.LATITUDE},${r.LONGITUDE}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      <MapPin size={12} /> Maps
                    </a>
                  ) : (
                    <span className="text-xs text-neutral-600">—</span>
                  ),
              },
              {
                key: "TIME",
                header: "Time",
                render: (r: LiveSignal) => (
                  <span className="text-xs font-mono text-neutral-400">
                    {new Date(r.RECEIVED_AT).toLocaleTimeString()}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </Card>

      {/* Drawer */}
      {selected && <VehicleDrawer signal={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/** ---------------- SMALL UI HELPERS ---------------- */
function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
        active
          ? "bg-indigo-600 text-white border-indigo-500/40"
          : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function VehicleDrawer({
  signal,
  onClose,
}: {
  signal: LiveSignal;
  onClose: () => void;
}) {
  const pill = statusPill(signal);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-white/10 bg-[#0b0f14] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-white">{signal.LICENSE_PLATE}</div>
            <div className="text-sm text-neutral-400">
              {signal.MAKE} {signal.MODEL}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${pill.cls}`}>
            {pill.label}
          </div>
          <div className="text-xs text-neutral-500 font-mono">
            Updated {new Date(signal.RECEIVED_AT).toLocaleTimeString()}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Event" value={String(signal.EVENT_TYPE || "").toUpperCase()} />
          <Stat label="Risk Score" value={String(riskScore(signal))} />
          <Stat label="Speed" value={`${signal.SPEED_KMH.toFixed(0)} km/h`} />
          <Stat label="Fuel" value={`${signal.FUEL_LEVEL_PCT.toFixed(0)} %`} />
          <Stat label="Temp" value={`${signal.ENGINE_TEMP_C.toFixed(0)} °C`} />
          <Stat label="Car ID" value={`#${signal.CAR_ID}`} />
        </div>

        <div className="mt-6">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${signal.LATITUDE},${signal.LONGITUDE}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition"
          >
            <MapPin size={18} />
            Open in Google Maps
          </a>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-bold text-white">Rules</div>
          <ul className="mt-2 space-y-1 text-xs text-neutral-400">
            <li>• Speeding: ≥ {SPEEDING_KMH} km/h</li>
            <li>• Overheat: ≥ {OVERHEAT_C} °C</li>
            <li>• Fuel low: ≤ {FUEL_LOW_PCT} %</li>
          </ul>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

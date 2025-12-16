import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import {
  ArrowLeft,
  MapPin,
  Gauge,
  Timer,
  AlertTriangle,
  Thermometer,
  Flame,
  TrendingUp,
  Route,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

/** Leaflet marker icon fix */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
(L.Marker.prototype as any).options.icon = DefaultIcon;

type ReportResponse = {
  rental: {
    RENTAL_ID: number;
    CAR_ID: number;
    BRANCH_ID: number;
    LICENSE_PLATE: string;
    MAKE: string;
    MODEL: string;
    START_AT: string;
    END_AT: string;
    telemetryPoints: number;
    simRentalId: number | null;
  };
  metrics: {
    avgSpeed: number;
    maxSpeed: number;
    distanceKm: number | null;
    speedingCount: number;
    harshBrakeCount: number;
    harshAccelCount: number;
    overheatCount: number;
    idleEvents: number;
    drivingEvents: number;
    fuel: { min: number | null; max: number | null; end: number | null };
  };
  route: Array<{
    ts: string;
    lat: number;
    lng: number;
    speed: number | null;
    event: string | null;
  }>;
};

function fmtDateTime(v: any) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
function fmtDate(v: any) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}
function fmtTime(v: any) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString();
}
function minutesBetween(a?: string, b?: string) {
  const A = a ? new Date(a).getTime() : NaN;
  const B = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(A) || !Number.isFinite(B)) return null;
  return Math.max(0, Math.round((B - A) / 60000));
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function toneForEvent(ev?: string | null) {
  const t = String(ev || "").toUpperCase();
  if (t === "DRIVING") return "blue";
  if (t === "IDLE") return "amber";
  if (t === "STOPPED") return "gray";
  return "gray";
}
function drivingScore(metrics: ReportResponse["metrics"] | null, totalPoints: number) {
  if (!metrics) return 0;
  const denom = Math.max(1, totalPoints);
  const penalty =
    (metrics.speedingCount / denom) * 40 +
    (metrics.overheatCount / denom) * 50 +
    (metrics.harshBrakeCount / denom) * 20 +
    (metrics.harshAccelCount / denom) * 20;
  return Math.round(clamp(100 - penalty, 0, 100));
}

export function RentalReportPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const t = token || localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/v1/rentals/${id}/report?sample=160`, {
          headers: {
            Accept: "application/json",
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed");

        if (alive) setData(json as ReportResponse);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [id, token]);

  /** ✅ Hooks that must ALWAYS run (even when loading/error) */
  const rental = data?.rental ?? null;
  const metrics = data?.metrics ?? null;
  const route = data?.route ?? [];

  const durationMin = useMemo(
    () => minutesBetween(rental?.START_AT, rental?.END_AT),
    [rental?.START_AT, rental?.END_AT]
  );

  const totalPoints = useMemo(
    () => (rental?.telemetryPoints ?? route.length ?? 0),
    [rental?.telemetryPoints, route.length]
  );

  const score = useMemo(
    () => drivingScore(metrics, totalPoints),
    [metrics, totalPoints]
  );

  const chart = useMemo(() => {
    return (route || [])
      .filter((p) => p && p.ts)
      .map((p, idx) => ({
        idx,
        t: fmtTime(p.ts),
        ts: p.ts,
        speed: p.speed ?? 0,
        event: String(p.event || "").toUpperCase(),
        lat: p.lat,
        lng: p.lng,
      }));
  }, [route]);

  const poly = useMemo(() => {
    return (route || [])
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => [p.lat, p.lng] as [number, number]);
  }, [route]);

  const mapCenter = useMemo<[number, number]>(() => {
    return poly[0] ?? [33.5731, -7.5898]; // fallback Casablanca
  }, [poly]);

  const startPos = useMemo(() => (poly.length ? poly[0] : null), [poly]);
  const endPos = useMemo(() => (poly.length ? poly[poly.length - 1] : null), [poly]);

  const insights = useMemo(() => {
    const m = metrics;
    const denom = Math.max(1, totalPoints);

    if (!m) return [];

    const list: Array<{ icon: any; title: string; desc: string; tone: "ok" | "warn" | "bad" }> = [];

    if (m.speedingCount > 0) {
      list.push({
        icon: TrendingUp,
        title: "Speeding detected",
        desc: `${m.speedingCount} points (${Math.round((m.speedingCount / denom) * 100)}% of telemetry)`,
        tone: "warn",
      });
    }
    if (m.overheatCount > 0) {
      list.push({
        icon: Flame,
        title: "Overheat risk",
        desc: `${m.overheatCount} events`,
        tone: "bad",
      });
    }
    if (m.harshBrakeCount + m.harshAccelCount > 0) {
      list.push({
        icon: AlertTriangle,
        title: "Aggressive driving",
        desc: `${m.harshBrakeCount} harsh brakes • ${m.harshAccelCount} harsh accelerations`,
        tone: "warn",
      });
    }

    if (list.length === 0) {
      list.push({
        icon: Gauge,
        title: "Smooth rental",
        desc: "No risk events detected in sampled telemetry.",
        tone: "ok",
      });
    }

    return list;
  }, [metrics, totalPoints]);

  /** ✅ Now returns are safe */
  if (loading) return <Card title="Rental Report" subtitle="Loading report...">Loading…</Card>;
  if (err) return <Card title="Rental Report" subtitle="Error">{err}</Card>;
  if (!data || !rental || !metrics) return <Card title="Rental Report">No data</Card>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/rentals" className="text-neutral-400 hover:text-white">
            <ArrowLeft />
          </Link>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                Rental Report <span className="text-neutral-500">#{rental.RENTAL_ID}</span>
              </h1>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  score >= 85
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : score >= 65
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                Driving Score: {score}/100
              </span>
            </div>

            <p className="mt-1 text-sm text-neutral-500">
              {rental.MAKE} {rental.MODEL} •{" "}
              <span className="font-mono text-neutral-400">{rental.LICENSE_PLATE}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="indigo">{fmtDate(rental.START_AT)} → {fmtDate(rental.END_AT)}</Badge>
          {durationMin != null && (
            <Badge tone="gray">
              <Timer className="mr-1 inline-block h-3.5 w-3.5" />
              {durationMin} min
            </Badge>
          )}
          <Badge tone="gray">
            <Route className="mr-1 inline-block h-3.5 w-3.5" />
            {metrics.distanceKm == null ? "Distance —" : `${metrics.distanceKm.toFixed(1)} km`}
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Kpi icon={Gauge} label="Avg Speed" value={`${metrics.avgSpeed.toFixed(1)} km/h`} />
        <Kpi icon={Gauge} label="Max Speed" value={`${metrics.maxSpeed.toFixed(0)} km/h`} />
        <Kpi icon={TrendingUp} label="Speeding" value={String(metrics.speedingCount)} />
        <Kpi icon={Thermometer} label="Overheats" value={String(metrics.overheatCount)} />
        <Kpi icon={AlertTriangle} label="Harsh Brakes" value={String(metrics.harshBrakeCount)} />
        <Kpi icon={AlertTriangle} label="Harsh Accel" value={String(metrics.harshAccelCount)} />
      </div>

      {/* INSIGHTS */}
      <Card title="Insights" subtitle="Quick interpretation of the trip">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.map((it, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border p-4 ${
                it.tone === "ok"
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : it.tone === "warn"
                  ? "border-amber-500/20 bg-amber-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              }`}
            >
              <div className="flex items-center gap-2 text-white font-bold">
                <it.icon className="h-5 w-5" />
                {it.title}
              </div>
              <div className="mt-2 text-sm text-neutral-400">{it.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* CHART + MAP */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card
          title="Speed Timeline"
          subtitle={`Sampled points: ${chart.length} (total: ${totalPoints})`}
          className="xl:col-span-2"
        >
          {chart.length === 0 ? (
            <div className="text-neutral-400">No chart data</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" tick={{ fill: "#a3a3a3", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#121212",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    labelStyle={{ color: "#e5e5e5" }}
                  />
                  <Area dataKey="speed" type="monotone" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Route Map" subtitle="Polyline of sampled GPS points">
          {poly.length === 0 ? (
            <div className="text-neutral-400">No GPS data</div>
          ) : (
            <div className="h-[280px] overflow-hidden rounded-2xl border border-white/10">
              <MapContainer center={mapCenter} zoom={12} style={{ height: "280px", width: "100%" }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Polyline positions={poly} pathOptions={{ weight: 4 }} />

                {startPos && (
                  <Marker position={startPos}>
                    <Popup>Start</Popup>
                  </Marker>
                )}
                {endPos && (
                  <Marker position={endPos}>
                    <Popup>End</Popup>
                  </Marker>
                )}

                {focusIdx != null && route[focusIdx] && (
                  <Marker position={[route[focusIdx].lat, route[focusIdx].lng]}>
                    <Popup>
                      <div className="text-sm font-bold">{fmtTime(route[focusIdx].ts)}</div>
                      <div className="text-xs">
                        Speed: {route[focusIdx].speed ?? "—"} km/h
                      </div>
                      <div className="text-xs">
                        Event: {String(route[focusIdx].event || "—").toUpperCase()}
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          )}
        </Card>
      </div>

      {/* EVENTS TABLE */}
      <Card title="Events" subtitle="Click a row to focus it on the map">
        {route.length === 0 ? (
          <div className="text-neutral-400">No events</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="text-neutral-500 bg-white/5">
                <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
                  <th>Time</th>
                  <th>Speed</th>
                  <th>Event</th>
                  <th>Map</th>
                </tr>
              </thead>
              <tbody>
                {route.map((p, i) => {
                  const sp = p.speed ?? null;
                  const speeding = sp != null && sp >= 120;

                  return (
                    <tr
                      key={i}
                      className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                      onClick={() => setFocusIdx(i)}
                    >
                      <td className="px-4 py-3 text-neutral-300">{fmtDateTime(p.ts)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-bold ${speeding ? "text-amber-300" : "text-white"}`}>
                          {sp == null ? "—" : `${sp} km/h`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={toneForEvent(p.event)}>{String(p.event || "—").toUpperCase()}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {p.lat && p.lng ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MapPin size={14} /> Open
                          </a>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="text-xs text-neutral-600">
        Data source: {rental.simRentalId ? "IOT_TELEMETRY (historical)" : "RT_IOT_FEED (fallback)"} •
        Telemetry points: {totalPoints}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121212] p-5 flex items-center gap-3">
      <div className="rounded-xl bg-white/5 p-2 text-neutral-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-lg font-bold text-white truncate">{value}</div>
      </div>
    </div>
  );
}

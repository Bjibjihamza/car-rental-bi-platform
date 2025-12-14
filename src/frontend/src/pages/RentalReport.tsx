import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ArrowLeft, MapPin, Gauge, Fuel, Thermometer } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export function RentalReportPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/v1/rentals/${id}/report`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed");
        setData(json);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <Card title="Rental Report">Loading...</Card>;
  if (err) return <Card title="Rental Report">{err}</Card>;

  const { rental, metrics, route } = data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link to="/rentals" className="text-neutral-400 hover:text-white">
          <ArrowLeft />
        </Link>
        <h1 className="text-2xl font-bold text-white">
          Rental Report #{rental.RENTAL_ID}
        </h1>
      </div>

      {/* CAR INFO */}
      <Card title="Vehicle">
        <div className="flex justify-between">
          <div>
            <div className="text-xl font-bold text-white">
              {rental.MAKE} {rental.MODEL}
            </div>
            <div className="text-neutral-400 font-mono">
              {rental.LICENSE_PLATE}
            </div>
          </div>
          <Badge tone="indigo">
            {new Date(rental.START_AT).toLocaleDateString()} →{" "}
            {new Date(rental.END_AT).toLocaleDateString()}
          </Badge>
        </div>
      </Card>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric icon={Gauge} label="Avg Speed" value={`${metrics.avgSpeed} km/h`} />
        <Metric icon={Gauge} label="Max Speed" value={`${metrics.maxSpeed} km/h`} />
        <Metric icon={Fuel} label="Fuel End" value={`${metrics.fuel?.end ?? "—"} %`} />
        <Metric icon={Thermometer} label="Overheats" value={metrics.overheatCount} />
      </div>

      {/* ROUTE */}
      <Card title="Route (GPS)">
        {route.length === 0 ? (
          <div className="text-neutral-400">No GPS data</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th>Time</th>
                <th>Speed</th>
                <th>Event</th>
                <th>Map</th>
              </tr>
            </thead>
            <tbody>
              {route.map((p: any, i: number) => (
                <tr key={i} className="border-t border-white/5">
                  <td>{new Date(p.ts).toLocaleString()}</td>
                  <td>{p.speed ?? "—"} km/h</td>
                  <td>{p.event ?? "—"}</td>
                  <td>
                    {p.lat && p.lng ? (
                      <a
                        href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                        target="_blank"
                        className="text-indigo-400 hover:underline"
                      >
                        <MapPin size={14} />
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: any) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <Icon className="text-indigo-400" />
        <div>
          <div className="text-xs text-neutral-400">{label}</div>
          <div className="text-lg font-bold text-white">{value}</div>
        </div>
      </div>
    </Card>
  );
}

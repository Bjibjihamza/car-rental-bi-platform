import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { telemetry } from "../data/mock";
import { Activity, Zap, Thermometer, Gauge } from "lucide-react";

export function TelemetryPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card 
        title="Live Telemetry Stream" 
        subtitle="Real-time sensor data from fleet devices"
        right={
            <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Live Feed</span>
            </div>
        }
      >
        <DataTable
          rows={telemetry}
          cols={[
            { key: "telemetryId", header: "ID", render: r => <span className="font-mono text-neutral-500">#{r.telemetryId}</span> },
            { key: "eventTs", header: "Timestamp", render: (r) => <span className="text-xs font-mono text-neutral-400">{new Date(r.eventTs).toLocaleString()}</span> },
            { key: "deviceId", header: "Device", render: r => <span className="text-white">Device #{r.deviceId}</span> },
            { key: "carId", header: "Car", render: r => <span className="text-indigo-300">Car #{r.carId}</span> },
            { 
                key: "eventType", 
                header: "Event", 
                render: (r) => {
                    const color = r.eventType === "HARSH_BRAKE" ? "red" : r.eventType === "RAPID_ACCEL" ? "amber" : "blue";
                    return <Badge tone={color}>{r.eventType.replace('_', ' ')}</Badge>;
                }
            },
            { key: "speedKmh", header: "Speed", render: (r) => (
                <div className="flex items-center gap-1.5 text-neutral-300">
                    <Gauge size={14} className="text-neutral-500"/> {r.speedKmh} km/h
                </div>
            )},
            { key: "fuelPct", header: "Fuel", render: (r) => (
                <div className="flex items-center gap-1.5 text-neutral-300">
                    <Zap size={14} className={r.fuelPct < 20 ? "text-red-400" : "text-emerald-400"}/> {r.fuelPct}%
                </div>
            )},
            { key: "engineTempC", header: "Temp", render: (r) => (
                <div className="flex items-center gap-1.5 text-neutral-300">
                    <Thermometer size={14} className="text-neutral-500"/> {r.engineTempC}°C
                </div>
            )},
          ]}
          initialPageSize={10}
        />
      </Card>
    </div>
  );
}
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { telemetry } from "../data/mock";

export function TelemetryPage() {
  return (
    <div className="grid gap-12">
      <Card title="IoT Telemetry Stream" right={<span className="badge badge-gray">Simulated</span>}>
        <DataTable
          rows={telemetry}
          cols={[
            { key: "telemetryId", header: "ID" },
            { key: "eventTs", header: "Event TS", render: (r) => new Date(r.eventTs).toLocaleString() },
            { key: "deviceId", header: "Device" },
            { key: "carId", header: "Car" },
            { key: "rentalId", header: "Rental", render: (r) => (r.rentalId ?? "—") },
            {
              key: "eventType",
              header: "Type",
              render: (r) => <Badge tone={r.eventType === "HARSH_BRAKE" ? "red" : r.eventType === "RAPID_ACCEL" ? "amber" : "blue"}>{r.eventType}</Badge>,
            },
            { key: "speedKmh", header: "Speed", render: (r) => `${r.speedKmh} km/h` },
            { key: "fuelPct", header: "Fuel", render: (r) => `${r.fuelPct}%` },
            { key: "engineTempC", header: "Engine °C", render: (r) => `${r.engineTempC}°C` },
          ]}
          initialPageSize={10}
        />
      </Card>
    </div>
  );
}

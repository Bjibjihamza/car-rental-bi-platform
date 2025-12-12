import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { devices } from "../data/mock";

export function DevicesPage() {
  return (
    <div className="grid gap-12">
      <Card title="IoT Devices" right={<button className="btn btn-primary">+ Register Device</button>}>
        <DataTable
          rows={devices}
          cols={[
            { key: "deviceId", header: "ID" },
            { key: "code", header: "Code" },
            { key: "imei", header: "IMEI" },
            { key: "firmware", header: "Firmware" },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "ACTIVE" ? "green" : r.status === "INACTIVE" ? "amber" : "gray"}>
                  {r.status}
                </Badge>
              ),
            },
            { key: "lastSeenAt", header: "Last seen", render: (r) => new Date(r.lastSeenAt).toLocaleString() },
            { key: "actions", header: "", render: () => <button className="btn btn-ghost btn-sm">Details</button> },
          ]}
        />
      </Card>
    </div>
  );
}

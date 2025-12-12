import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { alerts, branches } from "../data/mock";

export function AlertsPage() {
  const rows = alerts.map((a) => ({
    ...a,
    branch: branches.find((b) => b.branchId === a.branchId)?.city ?? "-",
  }));

  return (
    <div className="grid gap-12">
      <Card title="Alerts" right={<button className="btn btn-ghost">Resolve selected (UI)</button>}>
        <DataTable
          rows={rows}
          cols={[
            { key: "alertId", header: "ID" },
            { key: "title", header: "Title" },
            { key: "branch", header: "Branch" },
            {
              key: "severity",
              header: "Severity",
              render: (r) => (
                <Badge tone={r.severity === "HIGH" ? "red" : r.severity === "MEDIUM" ? "amber" : "gray"}>
                  {r.severity}
                </Badge>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => <Badge tone={r.status === "OPEN" ? "blue" : "green"}>{r.status}</Badge>,
            },
            { key: "createdAt", header: "Created", render: (r) => new Date(r.createdAt).toLocaleString() },
            { key: "actions", header: "", render: () => <button className="btn btn-ghost btn-sm">View</button> },
          ]}
        />
      </Card>
    </div>
  );
}

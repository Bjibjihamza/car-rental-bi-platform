import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { alerts, branches } from "../data/mock";
import { AlertTriangle, CheckCircle, Eye } from "lucide-react";

export function AlertsPage() {
  // Join alerts with branch data
  const rows = alerts.map((a) => ({
    ...a,
    branch: branches.find((b) => b.branchId === a.branchId)?.city ?? "Unknown",
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card 
        title="Incident Alerts" 
        subtitle="Critical fleet events requiring attention"
        right={
            <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition">
                Resolve Selected
            </button>
        }
      >
        <DataTable
          rows={rows}
          cols={[
            { key: "alertId", header: "ID", render: r => <span className="font-mono text-neutral-500">#{r.alertId}</span> },
            { key: "severity", header: "Severity", render: (r) => (
                <Badge tone={r.severity === "HIGH" ? "red" : r.severity === "MEDIUM" ? "amber" : "gray"}>
                  {r.severity}
                </Badge>
              ),
            },
            { key: "title", header: "Incident", render: r => (
                <div className="flex items-center gap-2 font-medium text-white">
                    <AlertTriangle size={16} className={r.severity === "HIGH" ? "text-red-400" : "text-amber-400"} />
                    {r.title}
                </div>
            )},
            { key: "branch", header: "Location", render: r => <span className="text-neutral-400">{r.branch}</span> },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                  <div className="flex items-center gap-1.5">
                      {r.status === "OPEN" ? <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"/> : <CheckCircle size={14} className="text-emerald-500"/>}
                      <span className={r.status === "OPEN" ? "text-blue-300" : "text-emerald-300 font-medium"}>{r.status}</span>
                  </div>
              ),
            },
            { key: "createdAt", header: "Time", render: (r) => <span className="text-xs text-neutral-500">{new Date(r.createdAt).toLocaleString()}</span> },
            { key: "actions", header: "", render: () => (
                <button className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition">
                    <Eye size={16} />
                </button>
            )},
          ]}
        />
      </Card>
    </div>
  );
}
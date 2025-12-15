import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { AlertTriangle, CheckCircle, Eye } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

type AlertRow = {
  ALERT_ID: number;
  BRANCH_ID: number | null;
  BRANCH_CITY: string;
  STATUS: "OPEN" | "RESOLVED";
  SEVERITY: "HIGH" | "MEDIUM" | "LOW";
  TITLE: string;
  CREATED_AT: string;
};

export function AlertsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/v1/iot-alerts`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function resolveSelected() {
    for (const id of selected) {
      await fetch(`${API_URL}/api/v1/iot-alerts/${id}/resolve`, {
        method: "PATCH",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    }
    setSelected([]);
    load();
  }

  useEffect(() => { load(); }, []);

  const openCount = useMemo(
    () => rows.filter((r) => r.STATUS === "OPEN").length,
    [rows]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card
        title="Incident Alerts"
        subtitle={`Critical fleet events requiring attention • Open: ${openCount}`}
        right={
          <button
            disabled={selected.length === 0}
            onClick={resolveSelected}
            className={`rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition
              ${selected.length === 0 ? "bg-white/5 opacity-50" : "bg-white/5 hover:bg-white/10"}`}
          >
            Resolve Selected ({selected.length})
          </button>
        }
      >
        <DataTable
          loading={loading}
          rows={rows}
          cols={[
            {
              key: "select",
              header: "",
              render: (r: AlertRow) => (
                <input
                  type="checkbox"
                  checked={selected.includes(r.ALERT_ID)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked ? [...prev, r.ALERT_ID] : prev.filter((x) => x !== r.ALERT_ID)
                    );
                  }}
                />
              ),
            },
            {
              key: "id",
              header: "ID",
              render: (r: AlertRow) => (
                <span className="font-mono text-neutral-500">#{r.ALERT_ID}</span>
              ),
            },
            {
              key: "severity",
              header: "Severity",
              render: (r: AlertRow) => (
                <Badge tone={r.SEVERITY === "HIGH" ? "red" : r.SEVERITY === "MEDIUM" ? "amber" : "gray"}>
                  {r.SEVERITY}
                </Badge>
              ),
            },
            {
              key: "title",
              header: "Incident",
              render: (r: AlertRow) => (
                <div className="flex items-center gap-2 font-medium text-white">
                  <AlertTriangle
                    size={16}
                    className={r.SEVERITY === "HIGH" ? "text-red-400" : "text-amber-400"}
                  />
                  {r.TITLE}
                </div>
              ),
            },
            {
              key: "branch",
              header: "Location",
              render: (r: AlertRow) => <span className="text-neutral-400">{r.BRANCH_CITY}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (r: AlertRow) => (
                <div className="flex items-center gap-1.5">
                  {r.STATUS === "OPEN" ? (
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  ) : (
                    <CheckCircle size={14} className="text-emerald-500" />
                  )}
                  <span className={r.STATUS === "OPEN" ? "text-blue-300" : "text-emerald-300 font-medium"}>
                    {r.STATUS}
                  </span>
                </div>
              ),
            },
            {
              key: "time",
              header: "Time",
              render: (r: AlertRow) => (
                <span className="text-xs text-neutral-500">
                  {new Date(r.CREATED_AT).toLocaleString()}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              render: () => (
                <button className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition">
                  <Eye size={16} />
                </button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

import { useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { cars, branches } from "../data/mock";

export function CarsPage() {
  const [branchId, setBranchId] = useState<number | "ALL">("ALL");
  const rows = useMemo(() => {
    const base = cars.map((c) => ({
      ...c,
      branch: branches.find((b) => b.branchId === c.branchId)?.city ?? "-",
    }));
    if (branchId === "ALL") return base;
    return base.filter((c) => c.branchId === branchId);
  }, [branchId]);

  return (
    <div className="grid gap-12">
      <Card
        title="Cars"
        right={
          <div className="row gap-8">
            <select className="select" value={branchId} onChange={(e) => setBranchId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}>
              <option value="ALL">All branches</option>
              {branches.map((b) => (
                <option key={b.branchId} value={b.branchId}>{b.city}</option>
              ))}
            </select>
            <button className="btn btn-primary">+ Add Car</button>
          </div>
        }
      >
        <DataTable
          rows={rows}
          cols={[
            { key: "carId", header: "ID" },
            { key: "make", header: "Make" },
            { key: "model", header: "Model" },
            { key: "year", header: "Year" },
            { key: "plate", header: "Plate" },
            { key: "category", header: "Category" },
            { key: "branch", header: "Branch" },
            { key: "deviceId", header: "Device", render: (r) => (r.deviceId ? `#${r.deviceId}` : "—") },
            {
              key: "status",
              header: "Status",
              render: (r) => {
                const tone =
                  r.status === "AVAILABLE" ? "green" :
                  r.status === "RENTED" ? "blue" :
                  r.status === "MAINTENANCE" ? "amber" :
                  r.status === "RETIRED" ? "gray" : "red";
                return <Badge tone={tone}>{r.status}</Badge>;
              },
            },
            { key: "odometerKm", header: "Odometer", render: (r) => `${r.odometerKm.toLocaleString()} km` },
            { key: "actions", header: "", render: () => <button className="btn btn-ghost btn-sm">Details</button> },
          ]}
        />
      </Card>
    </div>
  );
}

import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { branches } from "../data/mock";

export function BranchesPage() {
  return (
    <div className="grid gap-12">
      <Card title="Branches" right={<button className="btn btn-primary">+ Add Branch</button>}>
        <DataTable
          rows={branches}
          cols={[
            { key: "branchId", header: "ID" },
            { key: "name", header: "Name" },
            { key: "city", header: "City" },
            { key: "phone", header: "Phone" },
            { key: "actions", header: "", render: () => <button className="btn btn-ghost btn-sm">Manage</button> },
          ]}
        />
      </Card>
    </div>
  );
}

import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { rentals, cars } from "../data/mock";

export function RentalsPage() {
  const rows = rentals.map((r) => ({
    ...r,
    car: `${cars.find((c) => c.carId === r.carId)?.make ?? ""} ${cars.find((c) => c.carId === r.carId)?.model ?? ""}`.trim(),
  }));

  return (
    <div className="grid gap-12">
      <Card title="Rentals" right={<button className="btn btn-primary">+ Create Rental</button>}>
        <DataTable
          rows={rows}
          cols={[
            { key: "rentalId", header: "ID" },
            { key: "car", header: "Car" },
            { key: "customer", header: "Customer" },
            { key: "startAt", header: "Start", render: (r) => new Date(r.startAt).toLocaleString() },
            { key: "dueAt", header: "Due", render: (r) => new Date(r.dueAt).toLocaleString() },
            { key: "returnAt", header: "Return", render: (r) => (r.returnAt ? new Date(r.returnAt).toLocaleString() : "—") },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge
                  tone={
                    r.status === "ACTIVE" ? "blue" :
                    r.status === "IN_PROGRESS" ? "amber" :
                    r.status === "CLOSED" ? "green" : "red"
                  }
                >
                  {r.status}
                </Badge>
              ),
            },
            { key: "totalAmount", header: "Amount", render: (r) => `${r.totalAmount.toFixed(2)} ${r.currency}` },
          ]}
        />
      </Card>
    </div>
  );
}

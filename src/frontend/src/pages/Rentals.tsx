import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { Link } from "react-router-dom";
import { RefreshCw, FileText, Plus } from "lucide-react";

type RentalRow = {
  RENTAL_ID: number;
  START_AT: string;
  DUE_AT: string;
  STATUS: string;
  TOTAL_AMOUNT: number | null;
  CURRENCY: string | null;
  MAKE?: string;
  MODEL?: string;
  LICENSE_PLATE?: string;
  CUSTOMER_FIRST_NAME?: string;
  CUSTOMER_LAST_NAME?: string;
  BRANCH_CITY?: string;
  IS_DRIVING?: number;
};

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

function fmtDate(v: string) {
  return new Date(v).toLocaleString();
}

function money(v: number | null, c: string | null) {
  if (v == null) return "—";
  const currency = !c || c === "SIM" ? "MAD" : c; // ✅ treat SIM as MAD for formatting
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency,
  }).format(v);
}



function badgeTone(status: string, driving?: number) {
  if (driving === 1) return "indigo";
  if (status === "ACTIVE") return "green";
  if (status === "CLOSED") return "gray";
  return "amber";
}

export function RentalsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<RentalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/v1/rentals?all=1`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.RENTAL_ID,
        r.MAKE,
        r.MODEL,
        r.LICENSE_PLATE,
        r.CUSTOMER_FIRST_NAME,
        r.CUSTOMER_LAST_NAME,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  }, [rows, q]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card
        title="Rentals"
        subtitle="Click details to view rental report"
        right={
          <div className="flex gap-2">
            <Link
              to="/rentals/new"
              className="h-9 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white hover:bg-indigo-500"
            >
              <Plus size={16} />
              New
            </Link>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
            />

            <button
              onClick={load}
              className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 border border-white/10 text-neutral-400 hover:text-white"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        }
      >
        <DataTable
          loading={loading}
          rows={filtered}
          cols={[
            { key: "id", header: "ID", render: (r) => `#${r.RENTAL_ID}` },
            {
              key: "car",
              header: "Vehicle",
              render: (r) => (
                <div>
                  <div className="font-bold text-white">
                    {r.MAKE} {r.MODEL}
                  </div>
                  <div className="text-xs text-neutral-400">{r.LICENSE_PLATE}</div>
                </div>
              ),
            },
            {
              key: "customer",
              header: "Customer",
              render: (r) => `${r.CUSTOMER_FIRST_NAME} ${r.CUSTOMER_LAST_NAME}`,
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={badgeTone(r.STATUS, r.IS_DRIVING)}>
                  {r.IS_DRIVING === 1 ? "DRIVING" : r.STATUS}
                </Badge>
              ),
            },
            {
              key: "dates",
              header: "Period",
              render: (r) => (
                <div className="text-xs">
                  <div>From: {fmtDate(r.START_AT)}</div>
                  <div>To: {fmtDate(r.DUE_AT)}</div>
                </div>
              ),
            },
            { key: "total", header: "Total", render: (r) => money(r.TOTAL_AMOUNT, r.CURRENCY) },
            {
              key: "actions",
              header: "",
              render: (r) => (
                <Link
                  to={`/rentals/${r.RENTAL_ID}/report`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline"
                >
                  <FileText size={14} />
                  Details
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

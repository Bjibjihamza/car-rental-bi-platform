import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { RefreshCw, Plus, Trash2 } from "lucide-react";

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

type CustomerRow = {
  CUSTOMER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL?: string | null;
  PHONE?: string | null;
  ID_NUMBER?: string | null;
  CREATED_AT?: string;
};

export function CustomersPage() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // create form
  const [fn, setFn] = useState("");
  const [ln, setLn] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idn, setIdn] = useState("");

  const [err, setErr] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/customers`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch customers");
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const qq = q.toLowerCase();
    return rows.filter((r) =>
      [r.CUSTOMER_ID, r.FIRST_NAME, r.LAST_NAME, r.EMAIL, r.PHONE, r.ID_NUMBER]
        .join(" ")
        .toLowerCase()
        .includes(qq)
    );
  }, [rows, q]);

  async function createCustomer() {
    setErr(null);
    try {
      if (!fn.trim() || !ln.trim()) {
        setErr("First name + Last name are required");
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          FIRST_NAME: fn,
          LAST_NAME: ln,
          EMAIL: email || null,
          PHONE: phone || null,
          ID_NUMBER: idn || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create customer");

      setFn(""); setLn(""); setEmail(""); setPhone(""); setIdn("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to create customer");
    }
  }

  async function deleteCustomer(id: number) {
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/customers/${id}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete customer");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete customer");
    }
  }

  const isSup = user?.role === "supervisor";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card
        title="Customers"
        subtitle="Create and manage customers"
        right={
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white"
            />
            <button
              onClick={load}
              className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 border border-white/10 text-neutral-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        }
      >
        {err && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* Create */}
        <div className="mb-6 grid gap-3 md:grid-cols-6">
          <input
            value={fn}
            onChange={(e) => setFn(e.target.value)}
            placeholder="First name *"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
          />
          <input
            value={ln}
            onChange={(e) => setLn(e.target.value)}
            placeholder="Last name *"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
          />
          <input
            value={idn}
            onChange={(e) => setIdn(e.target.value)}
            placeholder="ID number"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
          />
          <button
            onClick={createCustomer}
            className="h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-500 md:col-span-1"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        {/* Table */}
        <DataTable
          loading={loading}
          rows={filtered}
          cols={[
            { key: "id", header: "ID", render: (r) => `#${r.CUSTOMER_ID}` },
            { key: "name", header: "Name", render: (r) => `${r.FIRST_NAME} ${r.LAST_NAME}` },
            { key: "email", header: "Email", render: (r) => r.EMAIL || "—" },
            { key: "phone", header: "Phone", render: (r) => r.PHONE || "—" },
            { key: "idn", header: "ID", render: (r) => r.ID_NUMBER || "—" },
            {
              key: "actions",
              header: "",
              render: (r) =>
                isSup ? (
                  <button
                    onClick={() => deleteCustomer(r.CUSTOMER_ID)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-300 hover:underline"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                ) : (
                  <span className="text-xs text-neutral-500">—</span>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

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
  NATIONAL_ID: string;
  DATE_OF_BIRTH: string;
  DRIVER_LICENSE_NO: string;
  EMAIL?: string | null;
  PHONE?: string | null;
  CREATED_AT?: string;
};

function fmtDate(d: any) {
  if (!d) return "—";
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function CustomersPage() {
  const { token, user } = useAuth();
  const isManager = String(user?.role || "").toLowerCase() === "manager";

  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [fn, setFn] = useState("");
  const [ln, setLn] = useState("");
  const [cin, setCin] = useState("");
  const [dob, setDob] = useState("");
  const [license, setLicense] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

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
      [
        r.CUSTOMER_ID,
        r.FIRST_NAME,
        r.LAST_NAME,
        r.NATIONAL_ID,
        r.DRIVER_LICENSE_NO,
        r.EMAIL,
        r.PHONE,
        r.DATE_OF_BIRTH,
      ]
        .join(" ")
        .toLowerCase()
        .includes(qq)
    );
  }, [rows, q]);

  async function createCustomer() {
    setErr(null);
    try {
      if (!isManager) {
        setErr("Only managers can add customers");
        return;
      }

      if (!fn.trim() || !ln.trim() || !cin.trim() || !dob.trim() || !license.trim()) {
        setErr("First name, Last name, CIN, DOB, and License are required");
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          FIRST_NAME: fn.trim(),
          LAST_NAME: ln.trim(),
          NATIONAL_ID: cin.trim(),
          DATE_OF_BIRTH: dob.trim(),
          DRIVER_LICENSE_NO: license.trim(),
          EMAIL: email ? email.trim() : null,
          PHONE: phone ? phone.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create customer");

      setFn("");
      setLn("");
      setCin("");
      setDob("");
      setLicense("");
      setEmail("");
      setPhone("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to create customer");
    }
  }

  async function deleteCustomer(id: number) {
    setErr(null);
    try {
      if (!isManager) {
        setErr("Only managers can delete customers");
        return;
      }

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card
        title="Customers"
        subtitle={isManager ? "Create and manage customers" : "View-only (supervisor)"}
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

        {!isManager && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            You are logged in as <b>{user?.role}</b>. Only <b>MANAGER</b> can create/delete customers.
          </div>
        )}

        {/* Create (manager only) */}
        <div className="mb-6 grid gap-3 md:grid-cols-8">
          <input
            value={fn}
            onChange={(e) => setFn(e.target.value)}
            placeholder="First name *"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
            disabled={!isManager}
          />
          <input
            value={ln}
            onChange={(e) => setLn(e.target.value)}
            placeholder="Last name *"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
            disabled={!isManager}
          />
          <input
            value={cin}
            onChange={(e) => setCin(e.target.value)}
            placeholder="CIN (NATIONAL_ID) *"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
            disabled={!isManager}
          />
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
            disabled={!isManager}
            title="Date of birth"
          />
          <input
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="Driver license *"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
            disabled={!isManager}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
            disabled={!isManager}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white md:col-span-1"
            disabled={!isManager}
          />
          <button
            onClick={createCustomer}
            className={`h-10 inline-flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white md:col-span-1 ${
              isManager ? "bg-indigo-600 hover:bg-indigo-500" : "bg-white/10 cursor-not-allowed"
            }`}
            disabled={!isManager}
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
            { key: "customer_id", header: "Customer ID", render: (r) => `#${r.CUSTOMER_ID}` },
            { key: "name", header: "Name", render: (r) => `${r.FIRST_NAME} ${r.LAST_NAME}` },
            { key: "cin", header: "CIN", render: (r) => r.NATIONAL_ID || "—" },
            { key: "dob", header: "DOB", render: (r) => fmtDate(r.DATE_OF_BIRTH) },
            { key: "license", header: "License", render: (r) => r.DRIVER_LICENSE_NO || "—" },
            { key: "email", header: "Email", render: (r) => r.EMAIL || "—" },
            { key: "phone", header: "Phone", render: (r) => r.PHONE || "—" },
            {
              key: "actions",
              header: "",
              render: (r) =>
                isManager ? (
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

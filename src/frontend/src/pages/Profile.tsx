// src/frontend/src/pages/Profile.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  Shield,
  Hash,
  Building2,
  RefreshCw,
  Save,
  KeyRound,
  User as UserIcon,
  Mail,
  Phone,
} from "lucide-react";

type Me = {
  managerId: number;
  managerCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "supervisor" | "manager";
  branchId: number | null;
};

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

function initials(first?: string, last?: string) {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "U";
}

export function ProfilePage() {
  const { user, token } = useAuth();

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [form, setForm] = useState({
    FIRST_NAME: "",
    LAST_NAME: "",
    EMAIL: "",
    PHONE: "",
  });

  const [pw, setPw] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const headers = useMemo(
    () => ({
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  async function loadMe() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/managers/me`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setMe(data);
      setForm({
        FIRST_NAME: data.firstName || "",
        LAST_NAME: data.lastName || "",
        EMAIL: data.email || "",
        PHONE: data.phone || "",
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const payload = {
        FIRST_NAME: form.FIRST_NAME.trim(),
        LAST_NAME: form.LAST_NAME.trim(),
        EMAIL: form.EMAIL.trim(),
        PHONE: form.PHONE.trim() || null,
      };

      const res = await fetch(`${API_URL}/api/v1/managers/me`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setOk("Account details saved.");
      await loadMe();
    } catch (e: any) {
      setErr(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function updatePassword() {
    setErr(null);
    setOk(null);

    if (!pw.currentPassword || !pw.newPassword) {
      setErr("Please fill current and new password.");
      return;
    }
    if (pw.newPassword !== pw.confirmPassword) {
      setErr("Password confirmation does not match.");
      return;
    }
    if (pw.newPassword.length < 6) {
      setErr("New password must be at least 6 characters.");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/managers/me/password`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          currentPassword: pw.currentPassword,
          newPassword: pw.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setOk("Password updated.");
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e: any) {
      setErr(e?.message || "Failed to update password");
    } finally {
      setPwSaving(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const roleLabel = useMemo(() => {
    const r = (me?.role || user?.role || "manager").toLowerCase();
    return r === "supervisor" ? "SUPERVISOR" : "MANAGER";
  }, [me?.role, user?.role]);

  const branchLabel = useMemo(() => {
    const b = me?.branchId ?? user?.branchId ?? null;
    return b ? `#${b}` : "ALL";
  }, [me?.branchId, user?.branchId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {err && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {ok}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT CARD */}
        <div className="lg:col-span-4">
          <div className="rounded-[28px] border border-white/5 bg-[#18181b] p-6 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-extrabold text-white shadow-lg shadow-indigo-500/20">
                {initials(me?.firstName, me?.lastName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-white">
                  {me?.firstName || user?.firstName || "—"}{" "}
                  {me?.lastName || user?.lastName || ""}
                </div>
                <div className="mt-1 inline-flex items-center rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-indigo-300">
                  {roleLabel}
                </div>
                <div className="mt-2 truncate text-sm text-neutral-400">
                  {me?.email || user?.email || "—"}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <InfoRow icon={Shield} label="Role" value={roleLabel} />
              <InfoRow icon={Hash} label="Manager Code" value={me?.managerCode || "—"} />
              <InfoRow icon={Building2} label="Branch Scope" value={branchLabel} />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-8 space-y-6">
          {/* ACCOUNT DETAILS */}
          <div className="rounded-[28px] border border-white/5 bg-[#18181b] shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-5">
              <div>
                <div className="text-lg font-bold text-white">Account Details</div>
                <div className="text-sm text-neutral-500">Update your personal information</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadMe}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition"
                >
                  <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  Refresh
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="First Name"
                  icon={UserIcon}
                  value={form.FIRST_NAME}
                  onChange={(v) => setForm((s) => ({ ...s, FIRST_NAME: v }))}
                />
                <Field
                  label="Last Name"
                  icon={UserIcon}
                  value={form.LAST_NAME}
                  onChange={(v) => setForm((s) => ({ ...s, LAST_NAME: v }))}
                />
                <Field
                  label="Email"
                  icon={Mail}
                  value={form.EMAIL}
                  onChange={(v) => setForm((s) => ({ ...s, EMAIL: v }))}
                />
                <Field
                  label="Phone"
                  icon={Phone}
                  value={form.PHONE}
                  placeholder="+212..."
                  onChange={(v) => setForm((s) => ({ ...s, PHONE: v }))}
                />
              </div>
            </div>
          </div>

          {/* SECURITY */}
          <div className="rounded-[28px] border border-white/5 bg-[#18181b] shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-5">
              <div>
                <div className="text-lg font-bold text-white">Security</div>
                <div className="text-sm text-neutral-500">Change your password</div>
              </div>

              <button
                onClick={updatePassword}
                disabled={pwSaving}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                {pwSaving ? "Updating..." : "Update Password"}
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PasswordField
                  label="Current Password"
                  value={pw.currentPassword}
                  onChange={(v) => setPw((s) => ({ ...s, currentPassword: v }))}
                  className="md:col-span-2"
                />
                <PasswordField
                  label="New Password"
                  value={pw.newPassword}
                  onChange={(v) => setPw((s) => ({ ...s, newPassword: v }))}
                />
                <PasswordField
                  label="Confirm Password"
                  value={pw.confirmPassword}
                  onChange={(v) => setPw((s) => ({ ...s, confirmPassword: v }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3 text-sm text-neutral-300">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-neutral-400">
          <Icon size={16} />
        </span>
        <span className="text-neutral-400">{label}</span>
      </div>
      <div className="text-sm font-extrabold text-white">{value}</div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon: any;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-neutral-400">{label}</div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
          <Icon size={16} />
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F14]/40 pl-10 pr-3 text-sm text-white outline-none transition focus:border-indigo-500/50"
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <div className="text-xs font-medium text-neutral-400">{label}</div>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F14]/40 px-3 text-sm text-white outline-none transition focus:border-indigo-500/50"
      />
    </div>
  );
}

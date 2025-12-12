import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Shield } from "lucide-react";

export function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("manager@driveops.io");
  const [password, setPassword] = useState("DriveOps#123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
      nav("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="absolute top-10 -right-24 h-72 w-72 rounded-full bg-violet-200/60 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-[0_30px_60px_rgba(15,23,42,0.12)] p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-11 w-11 rounded-2xl bg-sky-500 text-white font-extrabold flex items-center justify-center">
            DO
          </div>
          <div>
            <div className="text-lg font-extrabold text-slate-900">DriveOps</div>
            <div className="text-xs text-slate-500">AI • IoT • Big Data Platform</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-900 font-extrabold mb-4">
          <Shield size={18} /> Sign in
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Email</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@driveops.io"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Password</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-300"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
            />
          </div>

          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            className="w-full rounded-2xl bg-sky-500 text-white font-extrabold py-3 hover:bg-sky-600 active:scale-[0.99] transition disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-center text-xs text-slate-500">
            Demo: <span className="font-bold text-slate-700">manager@driveops.io</span> /{" "}
            <span className="font-bold text-slate-700">DriveOps#123</span>
          </div>
        </form>
      </div>
    </div>
  );
}

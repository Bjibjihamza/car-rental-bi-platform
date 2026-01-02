// ✅ FIX: src/frontend/src/pages/Login.tsx (works with new AuthContext.login(email,password))
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Car, Loader2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = location.state?.from || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !email.trim() || !password;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#09090b] p-6 overflow-hidden selection:bg-indigo-500/30">
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="rounded-[32px] border border-white/10 bg-[#121212]/80 backdrop-blur-xl shadow-2xl p-8 sm:p-10 animate-in zoom-in-95 fade-in duration-500">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
<Car className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-neutral-400">
              Enter your credentials to access the <br />
              <span className="text-indigo-400 font-medium">Fleet Command Center</span>.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-neutral-500 group-focus-within:text-white transition-colors" />
                <input
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/10 bg-[#18181b] py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-600 focus:border-indigo-500 focus:bg-[#18181b] focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@fleet.local"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-neutral-500 group-focus-within:text-white transition-colors" />
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-white/10 bg-[#18181b] py-3 pl-12 pr-12 text-sm text-white placeholder-neutral-600 focus:border-indigo-500 focus:bg-[#18181b] focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-4 top-3.5 text-neutral-500 hover:text-white transition-colors"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              className="group relative w-full overflow-hidden rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 hover:shadow-indigo-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2">
                {loading && <Loader2 className="animate-spin" size={18} />}
                <span>{loading ? "Authenticating..." : "Sign In"}</span>
              </div>
            </button>
          </form>

          <div className="mt-8 border-t border-white/5 pt-6 text-center">
            <p className="text-xs text-neutral-600">Restricted access. Authorized personnel only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

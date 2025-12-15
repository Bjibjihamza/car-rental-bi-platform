import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const API_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Fleet overview & daily ops" },
  "/cars": { title: "Cars", subtitle: "Fleet inventory & status" },
  "/devices": { title: "IoT Devices", subtitle: "Track & monitor devices" },
  "/branches": { title: "Branches", subtitle: "Locations & branch scope" },
  "/rentals": { title: "Rentals", subtitle: "Reservations & lifecycle" },
  "/alerts": { title: "Alerts", subtitle: "Incidents & notifications" },
  "/telemetry": { title: "Telemetry", subtitle: "Events stream & metrics" },
  "/managers": { title: "Managers", subtitle: "Admin management" },
  "/live": { title: "Live Monitor", subtitle: "Real-time vehicle status" },
  "/profile": { title: "Profile", subtitle: "Account & security settings" },
};

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function initials(first?: string, last?: string) {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "U";
}

type BranchMeta = { name: string; city: string };

export function Topbar() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);

  // Alerts
  const [bellOpen, setBellOpen] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);

  // Manager branch badge: Name + City
  const [branchMeta, setBranchMeta] = useState<BranchMeta | null>(null);

  const pageMeta = useMemo(() => {
    const base = "/" + location.pathname.split("/").filter(Boolean)[0];
    return TITLES[base] || { title: "DriveOps", subtitle: "Fleet command center" };
  }, [location.pathname]);

  // ✅ Load branch (manager only): GET /api/v1/branches returns ONE row for manager
  useEffect(() => {
    let alive = true;

    async function loadBranch() {
      if (user?.role !== "manager") {
        setBranchMeta(null);
        return;
      }

      const t = token || localStorage.getItem("token");
      if (!t) {
        setBranchMeta(null);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/v1/branches`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${t}`,
          },
        });

        if (!res.ok) {
          if (alive) setBranchMeta(null);
          return;
        }

        const json = await res.json();
        const row = Array.isArray(json) ? json[0] : json;

        // Support BOTH shapes:
        // - object: { BRANCH_NAME, CITY, ... }
        // - array:  [BRANCH_ID, BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL, CREATED_AT]
        const name =
          (row && !Array.isArray(row) ? row.BRANCH_NAME ?? row.branchName ?? row.name : row?.[1]) ??
          null;

        const city =
          (row && !Array.isArray(row) ? row.CITY ?? row.city : row?.[2]) ??
          null;

        if (alive && name && city) {
          setBranchMeta({ name: String(name), city: String(city) });
        } else if (alive) {
          // strict: if missing => show nothing
          setBranchMeta(null);
        }
      } catch {
        if (alive) setBranchMeta(null);
      }
    }

    loadBranch();
    return () => {
      alive = false;
    };
  }, [user?.role, token]);

  // ✅ Poll unresolved alerts count every 5 seconds
  useEffect(() => {
    let alive = true;

    async function loadCount() {
      try {
        const t = token || localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/v1/iot-alerts/unresolved-count`, {
          headers: {
            Accept: "application/json",
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
        });

        const json = await res.json();
        if (!res.ok) return;

        if (alive) setAlertCount(Number(json?.count || 0));
      } catch {
        // ignore
      }
    }

    loadCount();
    const it = setInterval(loadCount, 5000);

    return () => {
      alive = false;
      clearInterval(it);
    };
  }, [token]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl transition-all">
      <div className="flex items-center justify-between px-6 py-4 lg:px-8">
        {/* LEFT */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {pageMeta.title}
            </h1>

            <span className="hidden md:block h-6 w-px bg-white/10" />

            <div className="hidden md:flex items-center gap-2 text-sm font-medium text-neutral-400">
              <span className="text-neutral-500">{formatDate()}</span>

              {/* ✅ Branch badge: Name • City */}
              {user?.role === "manager" && branchMeta && (
                <>
                  <span className="h-4 w-px bg-white/10" />
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-0.5 text-xs font-semibold text-indigo-300">
                    {branchMeta.name} <span className="text-indigo-200/70">•</span>{" "}
                    {branchMeta.city}
                  </span>
                </>
              )}
            </div>
          </div>

          <p className="mt-1 text-sm text-neutral-500 truncate">{pageMeta.subtitle}</p>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="hidden md:flex group relative items-center">
            <Search className="absolute left-3 h-4 w-4 text-neutral-500 group-focus-within:text-indigo-400 transition" />
            <input
              type="text"
              placeholder="Search fleet..."
              className="h-10 w-[240px] rounded-xl border border-white/5 bg-white/5 pl-10 pr-10 text-sm text-white placeholder-neutral-500 outline-none transition-all focus:border-indigo-500/50 focus:bg-white/10 focus:w-[280px]"
            />
            <div className="absolute right-3 flex items-center gap-1">
              <kbd className="hidden rounded bg-[#18181b] px-1.5 py-0.5 text-[10px] font-bold text-neutral-400 lg:inline-block border border-white/10">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Alerts */}
          <div className="relative">
            <button
              onClick={() => setBellOpen((v) => !v)}
              className="group relative grid h-10 w-10 place-items-center rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition"
            >
              <Bell className="h-5 w-5 text-neutral-400 group-hover:text-white transition" />
              {alertCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-[11px] font-bold text-white grid place-items-center ring-2 ring-[#09090b]">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-[#121212] p-2 shadow-xl shadow-black/50 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-white/5">
                    <div className="text-sm font-bold text-white">Alerts</div>
                    <div className="text-xs text-neutral-400">{alertCount} unresolved incidents</div>
                  </div>

                  <button
                    onClick={() => {
                      setBellOpen(false);
                      navigate("/alerts");
                    }}
                    className="mt-2 w-full rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-sm font-medium text-white transition"
                  >
                    View Alerts
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-3 rounded-xl border border-transparent bg-transparent py-1 pl-1 pr-2 hover:bg-white/5 transition border-white/5"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
                {initials(user?.firstName, user?.lastName)}
              </div>

              <div className="hidden text-right md:block">
                <div className="text-sm font-bold text-white leading-none">
                  {user?.firstName}
                </div>
                <div className="mt-1 text-[11px] font-medium text-indigo-300 leading-none uppercase tracking-wide">
                  {user?.role ?? "Admin"}
                </div>
              </div>

              <ChevronDown
                className={`h-4 w-4 text-neutral-500 transition-transform duration-200 ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl border border-white/10 bg-[#121212] p-1.5 shadow-xl shadow-black/50 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-3 border-b border-white/5 mb-1">
                    <p className="text-sm font-medium text-white">Signed in as</p>
                    <p className="truncate text-xs text-neutral-400">{user?.email}</p>
                  </div>

                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/profile");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white transition"
                    >
                      <User className="h-4 w-4" /> Profile
                    </button>

                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4" /> Settings
                    </button>
                  </div>

                  <div className="my-1 h-px bg-white/5" />

                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// src/frontend/src/components/Topbar.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Fleet overview & daily ops" },
  "/cars": { title: "Cars", subtitle: "Fleet inventory & status" },
  "/devices": { title: "IoT Devices", subtitle: "Track & monitor devices" },
  "/branches": { title: "Branches", subtitle: "Locations & branch scope" },
  "/rentals": { title: "Rentals", subtitle: "Reservations & lifecycle" },
  "/alerts": { title: "Alerts", subtitle: "Incidents & notifications" },
  "/telemetry": { title: "Telemetry", subtitle: "Events stream & metrics" },
  "/managers": { title: "Managers", subtitle: "Admin management" },
  "/profile": { title: "Profile", subtitle: "Your account & access details" }, // ✅ NEW
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

export function Topbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate(); // ✅ NEW
  const [menuOpen, setMenuOpen] = useState(false);

  const pageMeta = useMemo(() => {
    const base = "/" + location.pathname.split("/").filter(Boolean)[0];
    return TITLES[base] || { title: "DriveOps", subtitle: "Fleet command center" };
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl transition-all">
      <div className="flex items-center justify-between px-6 py-4 lg:px-8">

        {/* LEFT: Page Title & Breadcrumbs */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {pageMeta.title}
            </h1>
            <span className="hidden md:block h-6 w-px bg-white/10" />
            <div className="hidden md:flex items-center gap-2 text-sm font-medium text-neutral-400">
              <span className="text-neutral-500">{formatDate()}</span>
            </div>
          </div>
          <p className="mt-1 text-sm text-neutral-500 truncate">{pageMeta.subtitle}</p>
        </div>

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-4">

          {/* 1. Search Bar (Glassy) */}
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

          {/* 2. Notifications Bell */}
          <button className="group relative grid h-10 w-10 place-items-center rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition">
            <Bell className="h-5 w-5 text-neutral-400 group-hover:text-white transition" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-[#09090b]" />
          </button>

          {/* 3. User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-3 rounded-xl border border-transparent bg-transparent py-1 pl-1 pr-2 hover:bg-white/5 transition border-white/5"
            >
              {/* Avatar */}
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
                {initials(user?.firstName, user?.lastName)}
              </div>

              {/* Text Info */}
              <div className="hidden text-right md:block">
                <div className="text-sm font-bold text-white leading-none">
                  {user?.firstName}
                </div>
                <div className="mt-1 text-[11px] font-medium text-indigo-300 leading-none uppercase tracking-wide">
                  {user?.role ?? "Admin"}
                </div>
              </div>

              <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl border border-white/10 bg-[#121212] p-1.5 shadow-xl shadow-black/50 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">

                  {/* User Header in Menu */}
                  <div className="px-3 py-3 border-b border-white/5 mb-1">
                    <p className="text-sm font-medium text-white">Signed in as</p>
                    <p className="truncate text-xs text-neutral-400">{user?.email}</p>
                  </div>

                  {/* Menu Items */}
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
                      onClick={() => {
                        setMenuOpen(false);
                        // navigate("/settings"); // if you create it later
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white transition"
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

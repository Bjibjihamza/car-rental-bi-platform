import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, Bell, ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Fleet overview & daily ops" },
  "/cars": { title: "Cars", subtitle: "Fleet inventory & status" },
  "/devices": { title: "IoT Devices", subtitle: "Track & monitor devices" },
  "/branches": { title: "Branches", subtitle: "Locations & branch scope" },
  "/rentals": { title: "Rentals", subtitle: "Reservations & lifecycle" },
  "/alerts": { title: "Alerts", subtitle: "Incidents & notifications" },
  "/telemetry": { title: "Telemetry", subtitle: "Events stream & metrics" },
};

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function initials(first?: string, last?: string) {
  const a = (first?.[0] ?? "").toUpperCase();
  const b = (last?.[0] ?? "").toUpperCase();
  return (a + b) || "U";
}

export function Topbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const pageMeta = useMemo(() => {
    const base = "/" + location.pathname.split("/").filter(Boolean)[0];
    return TITLES[location.pathname] || TITLES[base] || { title: "DriveOps", subtitle: "Fleet command center" };
  }, [location.pathname]);

  return (
    <header className="px-5 pt-6 lg:px-7">
      <div className="flex items-center justify-between gap-4">
        {/* Left: title + subtitle */}
        <div className="min-w-0">
          <div className="text-[26px] font-extrabold tracking-tight text-slate-900">
            {pageMeta.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="truncate">{pageMeta.subtitle}</span>
            <span className="text-slate-300">•</span>
            <span>{formatDate()}</span>
          </div>
        </div>

        {/* Right: search + icons + user */}
        <div className="flex items-center gap-3">
          {/* Search pill */}
          <div className="hidden md:flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="w-[280px] bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Search cars, rentals, alerts..."
            />
            <kbd className="ml-2 rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-400 ring-1 ring-black/5">
              ⌘K
            </kbd>
          </div>

          {/* bell */}
          <button className="relative grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 hover:bg-slate-50">
            <Bell className="h-5 w-5 text-slate-600" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-500" />
          </button>

          {/* user */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5 hover:bg-slate-50"
            >
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-sm font-bold text-slate-900">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-slate-500">{user?.role ?? "User"}</div>
              </div>

              <div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 text-sm font-extrabold text-white">
                {initials(user?.firstName, user?.lastName)}
              </div>

              <ChevronDown className="hidden sm:block h-4 w-4 text-slate-400" />
            </button>

            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                />
                <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
                  <div className="px-4 py-3 border-b border-black/5">
                    <div className="text-sm font-bold text-slate-900">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-slate-500">{user?.email ?? "—"}</div>
                  </div>
                  <div className="p-2 text-xs text-slate-500">
                    (menu items here…)
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

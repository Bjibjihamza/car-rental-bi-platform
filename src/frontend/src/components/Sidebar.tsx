import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Car, Cpu, KeyRound, GitBranch, Bell, Activity, ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cars", label: "Fleet", icon: Car },
  { to: "/devices", label: "IoT Devices", icon: Cpu },
  { to: "/rentals", label: "Rentals", icon: KeyRound },
  { to: "/branches", label: "Locations", icon: GitBranch },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/telemetry", label: "Telemetry", icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex h-[calc(100vh-3rem)] sticky top-6 flex-col justify-between rounded-3xl border border-white/10 bg-neutral-900/80 backdrop-blur-md p-4 shadow-xl">
      <div>
        {/* Brand */}
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/20">
            DO
          </div>
          <div>
            <div className="font-bold text-lg text-white tracking-tight">DriveOps</div>
            <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
              Fleet Command
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-white/10 text-white shadow-inner"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute left-0 h-6 w-1 rounded-r-full bg-indigo-500"
                      />
                    )}
                    <Icon className={`h-5 w-5 transition-colors ${isActive ? "text-indigo-400" : "text-neutral-500 group-hover:text-white"}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Mini Profile */}
      <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-neutral-800" />
          <div className="overflow-hidden">
            <div className="truncate text-sm font-semibold text-white">Manager</div>
            <div className="truncate text-xs text-neutral-500">View Profile</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
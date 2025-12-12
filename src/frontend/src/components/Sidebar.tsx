import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Cpu,
  GitBranch,
  Bell,
  Activity,
  KeyRound,
  ChevronRight,
  LogOut
} from "lucide-react";

// 1. THIS WAS MISSING: The navigation data array
const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cars", label: "Cars", icon: Car },
  { to: "/devices", label: "IoT Devices", icon: Cpu },
  { to: "/rentals", label: "Rentals", icon: KeyRound },
  { to: "/branches", label: "Branches", icon: GitBranch },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/telemetry", label: "Telemetry", icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex h-[calc(100vh-2rem)] w-[280px] flex-col rounded-3xl bg-slate-900 text-white shadow-2xl">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/30">
          DO
        </div>
        <div>
          <div className="font-bold text-lg tracking-tight">DriveOps</div>
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Enterprise
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 space-y-1 px-4 overflow-y-auto">
        <div className="px-2 mb-2 text-xs font-semibold text-slate-500 uppercase">
          Main Menu
        </div>
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 
                ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 opacity-70 group-hover:opacity-100" />
                <span>{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-50 group-hover:translate-x-0" />
            </NavLink>
          );
        })}
      </div>

      {/* Footer User Profile */}
      <div className="p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-800 p-4 border border-slate-700">
          <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-200 font-bold border border-indigo-500/30">
            M
          </div>
          <div className="overflow-hidden">
            <div className="truncate text-sm font-semibold text-white">
              Manager
            </div>
            <div className="truncate text-xs text-slate-400">
              admin@driveops.com
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Cpu,
  MapPin,
  ClipboardList,
  Bell,
  Activity,
  Users,
  LogOut,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/cars", icon: Car, label: "Fleet" },
  { to: "/devices", icon: Cpu, label: "IoT" },
  { to: "/branches", icon: MapPin, label: "Locations" },
  { to: "/rentals", icon: ClipboardList, label: "Rentals" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/telemetry", icon: Activity, label: "Telemetry" },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="bg-[#0B0F14] text-white/80">
      <div className="flex h-full flex-col items-center px-3 py-4">
        {/* Logo */}
        <div className="mb-4 mt-1 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_14px_40px_-22px_rgba(99,102,241,0.9)]">
          <span className="text-sm font-black tracking-tight text-white">do</span>
        </div>

        {/* Nav */}
        <nav className="mt-2 flex flex-1 flex-col items-center gap-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "group relative grid h-11 w-11 place-items-center rounded-2xl transition",
                  "hover:bg-white/10",
                  isActive ? "bg-white/12" : "",
                ].join(" ")
              }
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  {/* left active indicator */}
                  {isActive && (
                    <span className="absolute -left-3 h-7 w-1 rounded-full bg-indigo-400" />
                  )}
                  <item.icon className="h-5 w-5 text-white/80 group-hover:text-white" />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom user */}
        <div className="mt-3 w-full rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
          <div className="grid place-items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xs font-extrabold text-white">
              {(user?.firstName?.[0] ?? "H").toUpperCase()}
              {(user?.lastName?.[0] ?? "B").toUpperCase()}
            </div>
            <button
              onClick={logout}
              className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 hover:bg-white/10 transition"
              title="Logout"
            >
              <LogOut className="h-5 w-5 text-white/80" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

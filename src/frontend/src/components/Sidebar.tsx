import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
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

// --- Custom Logo Component (SVG) ---
const AppLogo = () => (
  <div className="relative grid h-12 w-12 place-items-center">
    {/* Outer Glow */}
    <div className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-lg" />
    
    {/* Main Icon Shape */}
    <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-inner ring-1 ring-white/20">
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        className="h-6 w-6 text-white"
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    </div>
  </div>
);

type NavItem = { to: string; icon: any; label: string; onlySupervisor?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/branches", icon: MapPin, label: "Locations" },
  { to: "/managers", icon: Users, label: "Managers", onlySupervisor: true },
  { to: "/devices", icon: Cpu, label: "IoT Status" },

  { to: "/cars", icon: Car, label: "Fleet" },
  { to: "/rentals", icon: ClipboardList, label: "Rentals" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/telemetry", icon: Activity, label: "Telemetry" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const isSup = user?.role === "supervisor";

  const items = NAV.filter((i) => (i.onlySupervisor ? isSup : true));

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-20 flex-col border-r border-white/10 bg-[#0B0F14] shadow-2xl">
      <div className="flex h-full flex-col items-center py-6">
        
        {/* Logo */}
        <div className="mb-8">
          <AppLogo />
        </div>

        {/* Navigation */}
        <nav className="flex w-full flex-1 flex-col items-center gap-4 px-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 
                ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] translate-x-1"
                    : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
                }`
              }
            >
              <item.icon className="h-5 w-5" strokeWidth={2} />

              {/* Tooltip (Appears on Hover) */}
              <div className="absolute left-14 z-[60] hidden whitespace-nowrap rounded-md border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white shadow-xl group-hover:block animate-in fade-in slide-in-from-left-2 duration-200">
                {item.label}
              </div>
            </NavLink>
          ))}
        </nav>

        {/* User & Logout Section */}
        <div className="mt-auto flex flex-col items-center gap-4 pb-2 w-full">
            {/* Divider */}
            <div className="h-px w-8 bg-white/10" />

            {/* User Avatar */}
            <div className="group relative grid h-10 w-10 place-items-center rounded-full bg-neutral-800 ring-2 ring-transparent transition hover:ring-indigo-500/50">
                <span className="text-xs font-bold text-indigo-400">
                    {(user?.firstName?.[0] ?? "H").toUpperCase()}
                </span>
                {/* User Tooltip */}
                <div className="absolute left-14 z-[60] hidden whitespace-nowrap rounded-md border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white shadow-xl group-hover:block">
                    Profile
                </div>
            </div>

            {/* Logout Button */}
            <button
                onClick={logout}
                title="Logout"
                className="group flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
                <LogOut className="h-5 w-5" />
            </button>
        </div>
      </div>
    </aside>
  );
}
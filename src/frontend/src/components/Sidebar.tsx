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
  Radio 
} from "lucide-react";

// --- Custom driveOps Logo Component (SVG) ---
const AppLogo = () => (
  <div className="relative grid h-12 w-12 place-items-center group">
    {/* Background Glow Effect */}
    <div className="absolute inset-0 rounded-xl bg-indigo-500/30 blur-lg transition-all group-hover:bg-indigo-500/50" />
    
    {/* Logo Container */}
    <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] ring-1 ring-white/10 transition-all group-hover:scale-105 group-hover:from-indigo-500 group-hover:to-violet-600">
      {/* driveOps SVG Icon */}
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        className="h-6 w-6 text-white"
      >
        <path 
            d="M19 13V10C19 8.89543 18.1046 8 17 8H6.99998C5.89541 8 4.99998 8.89543 4.99998 10V13M19 13C19 14.1046 18.1046 15 17 15H6.99998C5.89541 15 4.99998 14.1046 4.99998 13M19 13H21V16H19M4.99998 13H2.99998V16H4.99998M7.99998 17V19M16 17V19" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
        />
        <path 
            d="M8.5 4.5C10.5 2.5 13.5 2.5 15.5 4.5M10 6C11.3333 5 12.6667 5 14 6" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="opacity-80"
        />
      </svg>
    </div>
  </div>
);

type NavItem = { to: string; icon: any; label: string; onlySupervisor?: boolean };

// ✅ UPDATED CONFIGURATION
const NAV: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/branches", icon: MapPin, label: "Locations", onlySupervisor: true }, 
  { to: "/managers", icon: Users, label: "Managers", onlySupervisor: true }, 
  { to: "/devices", icon: Cpu, label: "IoT Status" },
  { to: "/cars", icon: Car, label: "Fleet" },
  { to: "/rentals", icon: ClipboardList, label: "Rentals" },
  { to: "/live", icon: Radio, label: "Live Monitor" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/telemetry", icon: Activity, label: "History" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  // Check if role is strictly supervisor
  const isSup = user?.role === "supervisor";

  // Filter items: 
  // If item is 'onlySupervisor', strictly check if user is supervisor.
  // Otherwise, show it.
  const items = NAV.filter((i) => (i.onlySupervisor ? isSup : true));

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-20 flex-col border-r border-white/10 bg-[#0B0F14] shadow-2xl">
      <div className="flex h-full flex-col items-center py-6">
        
        {/* Logo Section */}
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
            <div className="h-px w-8 bg-white/10" />
            
            {/* User Profile Initials */}
            <div className="group relative grid h-10 w-10 place-items-center rounded-full bg-neutral-800 ring-2 ring-transparent transition hover:ring-indigo-500/50">
                <span className="text-xs font-bold text-indigo-400">
                    {(user?.firstName?.[0] ?? "H").toUpperCase()}
                </span>
                <div className="absolute left-14 z-[60] hidden whitespace-nowrap rounded-md border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white shadow-xl group-hover:block">
                    {user?.firstName} ({user?.role})
                </div>
            </div>

            {/* Logout Button */}
            <button
                onClick={logout}
                className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
                <LogOut className="h-5 w-5" />
                 <div className="absolute left-14 z-[60] hidden whitespace-nowrap rounded-md border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white shadow-xl group-hover:block">
                    Logout
                </div>
            </button>
        </div>
      </div>
    </aside>
  );
}
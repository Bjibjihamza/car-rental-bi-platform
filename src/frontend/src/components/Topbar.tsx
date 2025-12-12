import { Search, LogOut, Bell, MapPin, ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useState } from "react";

export function Topbar() {
  // Assuming useAuth returns 'user' or 'manager'. Adapting to your previous snippet.
  const { user, logout } = useAuth(); 
  
  // Fallback if your auth context uses 'manager' instead of 'user'
  const manager = user || (useAuth() as any).manager;

  const [isSearchFocused, setSearchFocused] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between rounded-3xl border border-white/5 bg-neutral-900/80 px-6 py-4 shadow-xl backdrop-blur-xl transition-all">
      
      {/* LEFT: Page Title / Breadcrumb */}
      <div className="flex flex-col">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Dashboard
        </h2>
        <p className="text-xs text-neutral-500 font-medium">
          {new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* CENTER: Search Bar (Hidden on mobile) */}
      <div className={`hidden md:flex items-center gap-2 transition-all duration-300 ${isSearchFocused ? 'w-96' : 'w-72'}`}>
        <div className="relative w-full group">
          <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${isSearchFocused ? 'text-indigo-400' : 'text-neutral-500'}`}>
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="block w-full rounded-full border border-white/5 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-neutral-500 focus:border-indigo-500/50 focus:bg-white/10 focus:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            placeholder="Search fleet, drivers, or alerts..."
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
             <kbd className="hidden lg:inline-flex items-center rounded border border-white/10 px-2 font-sans text-[10px] font-medium text-neutral-500">
               ⌘K
             </kbd>
          </div>
        </div>
      </div>

      {/* RIGHT: Manager Profile & Actions */}
      <div className="flex items-center gap-4">
        
        {/* Notification Bell */}
        <button className="relative rounded-full p-2 text-neutral-400 hover:bg-white/5 hover:text-white transition">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-neutral-900" />
        </button>

        {/* Separator */}
        <div className="h-8 w-px bg-white/10 hidden sm:block" />

        {/* Manager Info */}
        <div className="flex items-center gap-3">
            {/* Text Info (Name & Branch) */}
            <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-bold text-white">
                    {manager?.firstName} {manager?.lastName}
                </span>
                
                {/* Branch Badge */}
                <div className="flex items-center gap-1 text-[10px] font-medium text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full mt-0.5 border border-indigo-500/20">
                    <MapPin className="h-3 w-3" />
                    {manager?.branchName || "HQ - Tetouan"} 
                    {/* Fallback text if branchName is null */}
                </div>
            </div>

            {/* Avatar & Dropdown Trigger */}
            <div className="group relative flex items-center gap-2 cursor-pointer">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 p-0.5 ring-2 ring-transparent group-hover:ring-indigo-500/50 transition">
                    <div className="h-full w-full rounded-full bg-neutral-900 flex items-center justify-center text-sm font-bold text-white">
                        {manager?.firstName?.charAt(0) || "M"}
                    </div>
                </div>
                
                {/* Logout Button (Small) */}
                <button 
                    onClick={logout}
                    className="hidden group-hover:flex absolute -bottom-10 right-0 w-32 bg-neutral-800 border border-white/10 rounded-xl p-2 items-center gap-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition shadow-xl"
                >
                    <LogOut className="h-3 w-3" />
                    Sign out
                </button>
            </div>
        </div>
      </div>
    </header>
  );
}
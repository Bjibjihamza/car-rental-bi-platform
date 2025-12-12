import { Search, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export function Topbar() {
  const { manager, logout } = useAuth();

  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-extrabold text-slate-900">
            DriveOps Administration
          </div>
          <div className="text-xs text-slate-500">
            Welcome, <span className="font-extrabold text-slate-800">{manager?.firstName}</span>{" "}
            • {manager?.branchName}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              className="w-72 text-sm outline-none placeholder:text-slate-400"
              placeholder="Search cars, devices, customers..."
            />
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50 active:scale-[0.99] transition"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

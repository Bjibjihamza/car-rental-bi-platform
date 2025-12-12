import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <Sidebar />
          <div className="min-w-0">
            <Topbar />
            <main className="mt-4">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function ProtectedLayout() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Topbar />
          <main className="px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

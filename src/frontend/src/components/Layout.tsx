import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar"; // See next file
import { Topbar } from "./Topbar";   // Keep your existing Topbar or update similarly
// Inside layouts/Layout.tsx
// ... imports

export function Layout() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 selection:bg-indigo-500/30">
      {/* Background Ambient Mesh (Keep as is) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-indigo-900/20 blur-[100px]" />
         <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-900/20 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] p-4 lg:p-6">
        {/* CHANGED GRID HERE: from 260px to 80px */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[80px_1fr]">
          <Sidebar />
          <div className="flex min-w-0 flex-col gap-6">
            <Topbar />
            <main>
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function Layout() {
  return (
    <div className="min-h-screen bg-[#EEF4F8] text-slate-900">
      {/* soft ambient */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/3 h-[520px] w-[520px] rounded-full bg-sky-300/25 blur-[90px]" />
        <div className="absolute -bottom-24 right-1/3 h-[520px] w-[520px] rounded-full bg-indigo-300/20 blur-[90px]" />
      </div>

      {/* App frame */}
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-6 lg:py-8">
        <div className="rounded-[28px] bg-[#F6FBFF] shadow-[0_18px_55px_-25px_rgba(15,23,42,0.25)] ring-1 ring-black/5 overflow-hidden">
          <div className="grid grid-cols-[84px_1fr]">
            <Sidebar />

            <div className="min-w-0 bg-transparent">
              <Topbar />
              <main className="px-5 pb-6 pt-4 lg:px-7">
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

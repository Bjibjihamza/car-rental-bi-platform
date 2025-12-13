// src/frontend/src/components/ProtectedLayout.tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function ProtectedLayout() {
  return (
    // 'selection' color adds that nice purple highlight when you select text
    <div className="min-h-screen w-full bg-[#09090b] text-white selection:bg-indigo-500/30">
      
      {/* 1. Sidebar 
          (It is 'fixed' inside its own component, so we just render it here) 
      */}
      <Sidebar />

      {/* 2. Main Content Wrapper
          CRITICAL FIX: 'ml-20' pushes this entire block 5rem (80px) to the right.
          This matches the w-20 width of the Sidebar exactly.
      */}
      <div className="ml-20 min-h-screen transition-all duration-300">
        
        {/* Topbar: Sticky at the top of the main content area */}
        <Topbar />

        {/* Page Content: Added max-width for large screens so it doesn't stretch too wide */}
        <main className="mx-auto max-w-[1600px] p-6 lg:p-8">
          <Outlet />
        </main>

      </div>

      {/* 3. Optional: Background Ambient Glows (The purple haze from your image) */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
         <div className="absolute -top-[10%] -left-[5%] h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
         <div className="absolute top-[20%] right-[10%] h-[500px] w-[500px] rounded-full bg-violet-600/5 blur-[100px]" />
      </div>

    </div>
  );
}
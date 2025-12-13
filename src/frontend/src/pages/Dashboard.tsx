// src/frontend/src/pages/Dashboard.tsx
import { useAuth } from "../auth/AuthContext";
import { GlassCard } from "../components/GlassCard";
import {
  Zap,
  Gauge,
  TrendingUp,
  MapPin,
  MoreHorizontal,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// --- MOCK DATA MATCHING IMAGE ---
const chartData = [
  { type: "Mon", count: 40 },
  { type: "Tue", count: 30 },
  { type: "Wed", count: 45 },
  { type: "Thu", count: 25 },
  { type: "Fri", count: 55 },
  { type: "Sat", count: 35 },
  { type: "Sun", count: 48 },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Hello, {user?.firstName || "Hamza"} 👋
          </h1>
          <p className="text-neutral-400">
            Here is your daily fleet command center.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
            Download Report
          </button>
          <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500">
            + Add Vehicle
          </button>
        </div>
      </div>

      {/* 2. MAIN GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* A. HERO CARD: NISSAN GTR (Spans 8 columns) */}
        <div className="lg:col-span-8">
          <GlassCard className="group relative h-full overflow-hidden !p-0">
            {/* Background Image / Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F14] via-[#0B0F14]/80 to-transparent z-10" />
            <img 
               src="https://images.unsplash.com/photo-1617788138017-80ad40651399?q=80&w=1000&auto=format&fit=crop"
               alt="Nissan GTR"
               className="absolute right-0 top-0 h-full w-2/3 object-cover opacity-60 transition duration-700 group-hover:scale-105 z-0"
            />

            <div className="relative z-20 flex h-full flex-col justify-between p-8">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
                   TOP PERFORMER
                </div>
                <h2 className="text-4xl font-bold text-white">Nissan GTR</h2>
                <p className="text-lg text-neutral-400">Nismo Edition</p>
              </div>

              <div className="mt-8 flex gap-8">
                <StatBox label="Power" value="600 BHP" icon={Zap} />
                <StatBox label="Speed" value="246.74" icon={Gauge} />
                <StatBox label="0-60" value="2.9s" icon={TrendingUp} />
              </div>

              <div className="mt-8">
                 <p className="text-sm text-neutral-500">Daily Rate</p>
                 <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">$8,700</span>
                    <span className="text-neutral-500">/ day</span>
                 </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* B. OVERVIEW STATS (Spans 4 columns) */}
        <div className="lg:col-span-4 space-y-6">
           <div className="grid grid-cols-2 gap-4 h-full">
              {/* Card 1: Total Fleet */}
              <div className="rounded-[24px] border border-white/5 bg-[#18181b] p-5">
                 <div className="text-sm text-neutral-500">Total Fleet</div>
                 <div className="mt-2 text-3xl font-bold text-white">42</div>
              </div>
              
              {/* Card 2: On Road (Green Text) */}
              <div className="rounded-[24px] border border-white/5 bg-[#18181b] p-5">
                 <div className="text-sm text-neutral-500">On Road</div>
                 <div className="mt-2 text-3xl font-bold text-emerald-400">28</div>
              </div>

              {/* Card 3: Maintenance (Orange Text) */}
              <div className="rounded-[24px] border border-white/5 bg-[#18181b] p-5">
                 <div className="text-sm text-neutral-500">Maintenance</div>
                 <div className="mt-2 text-3xl font-bold text-orange-400">5</div>
              </div>

              {/* Card 4: REVENUE (Purple Background) */}
              <div className="rounded-[24px] bg-[#6366F1] p-5 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)]">
                 <div className="text-sm text-indigo-100">Revenue</div>
                 <div className="mt-2 text-3xl font-bold text-white">$12k</div>
              </div>
           </div>

           {/* Location Mini Card */}
           <div className="rounded-[24px] border border-white/5 bg-[#18181b] p-4 flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/5">
                 <MapPin className="h-5 w-5 text-neutral-400" />
              </div>
              <div>
                 <div className="text-sm font-bold text-white">Main HQ</div>
                 <div className="text-xs text-neutral-500">Tetouan, Morocco</div>
              </div>
           </div>
        </div>

        {/* C. CHART SECTION */}
        <div className="lg:col-span-8">
          <GlassCard title="Telemetry Analysis">
            <div className="h-[200px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={20}>
                     <XAxis 
                        dataKey="type" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "#525252", fontSize: 12 }} 
                        dy={10}
                     />
                     <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                     />
                     <Bar dataKey="count" radius={[4, 4, 4, 4]}>
                        {chartData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* D. LIVE STATUS LIST */}
        <div className="lg:col-span-4">
           <GlassCard title="Live Status" className="h-full">
              <div className="space-y-4">
                 {[1,2,3].map((_, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                       <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 font-bold">
                             {["R", "D", "F"][i]}
                          </div>
                          <div>
                             <div className="text-sm font-bold text-white">8888</div>
                             <div className="text-xs text-neutral-500">Rober Hoak</div>
                          </div>
                       </div>
                       <div className="rounded bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-400">
                          IN ROUTE
                       </div>
                    </div>
                 ))}
              </div>
           </GlassCard>
        </div>

      </div>
    </div>
  );
}

// Helper for the hero card
function StatBox({ label, value, icon: Icon }: any) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}
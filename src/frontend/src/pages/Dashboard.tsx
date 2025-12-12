import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { GlassCard } from "../components/GlassCard"; // Import the component created above
import { cars, telemetry } from "../data/mock";
import {
  Gauge, Zap, Droplet, Settings, MapPin, 
  CalendarDays, TrendingUp, ArrowUpRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// --- HELPERS & TYPES ---
const featuredCar = {
  name: "Nissan GTR",
  model: "Nismo Edition",
  // Using a transparent PNG car image usually looks better in dark mode, but this URL works too
  image: "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&q=80&w=1000",
  price: "$38,700",
  specs: {
    engine: "3745 cc", power: "641 BHP", transmission: "6 Speed",
    cylinders: "4 Inline", battery: "1997 CC", speed: "246.74", run: "9,245 Km",
  },
};

export function DashboardPage() {
  const { user, token } = useAuth();
  // ... (Keep your fetch logic here, I am omitting for brevity but keep it!) ...

  const chartData = useMemo(() => {
    return Object.entries(
      telemetry.reduce<Record<string, number>>((acc, t) => {
        acc[t.eventType] = (acc[t.eventType] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([k, v]) => ({ type: k, count: v * 10 }));
  }, []);

  const liveStatusList = useMemo(() => {
    return (cars || []).slice(0, 4).map((car, index) => ({
      no: `#${index + 1}`,
      carNo: (car.licensePlate || "AB-8888").slice(-4),
      driver: ["Rober Hoak", "Daniyel Dam", "Faizan Finy", "Elion Musk"][index] || "Unknown",
      status: car.status === "AVAILABLE" ? "In Route" : car.status === "MAINTENANCE" ? "Pending" : "Completed",
      earning: "$35.44",
      // Mapping status to Tailwind colors
      statusColor: car.status === "AVAILABLE" ? "text-blue-400 bg-blue-400/10" : car.status === "MAINTENANCE" ? "text-emerald-400 bg-emerald-400/10" : "text-orange-400 bg-orange-400/10",
    }));
  }, []);

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Hello, {user?.firstName || "Hamza"} 👋
          </h1>
          <p className="text-neutral-400 mt-1">Here is your daily fleet command center.</p>
        </div>
        <div className="flex gap-3">
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium border border-white/10 transition">
                Download Report
            </button>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition">
                + Add Vehicle
            </button>
        </div>
      </div>

      {/* 2. THE BENTO GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6">
        
        {/* A. FEATURED CAR HERO (Spans 8 columns) */}
        <div className="md:col-span-6 lg:col-span-8">
            <GlassCard className="h-full relative overflow-visible group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/40 to-transparent z-0" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 h-full">
                    <div className="flex-1 space-y-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-3">
                                <Zap className="w-3 h-3" /> Top Performer
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-1">{featuredCar.name}</h2>
                            <p className="text-neutral-400">{featuredCar.model}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <StatBox label="Power" value={featuredCar.specs.power} icon={Zap} />
                            <StatBox label="Speed" value={featuredCar.specs.speed} icon={Gauge} />
                            <StatBox label="0-60" value="2.9s" icon={TrendingUp} />
                        </div>

                        <div className="pt-2">
                             <div className="text-sm text-neutral-500 mb-1">Daily Rate</div>
                             <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold text-white">{featuredCar.price}</span>
                                <span className="text-neutral-500 mb-1">/ day</span>
                             </div>
                        </div>
                    </div>
                    
                    {/* Floating Car Image */}
                    <div className="flex-1 relative">
                         <img 
                            src={featuredCar.image} 
                            alt="Car" 
                            className="w-full object-cover rounded-2xl shadow-2xl border border-white/10 transform group-hover:scale-[1.02] transition-transform duration-500"
                         />
                    </div>
                </div>
            </GlassCard>
        </div>

        {/* B. MINI CALENDAR / DATE (Spans 4 columns) */}
        <div className="md:col-span-6 lg:col-span-4 space-y-6">
             <GlassCard className="h-full flex flex-col justify-between" title="Overview">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="text-neutral-400 text-sm mb-2">Total Fleet</div>
                        <div className="text-2xl font-bold text-white">42</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="text-neutral-400 text-sm mb-2">On Road</div>
                        <div className="text-2xl font-bold text-emerald-400">28</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="text-neutral-400 text-sm mb-2">Maintenance</div>
                        <div className="text-2xl font-bold text-orange-400">5</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-600 border border-indigo-500">
                        <div className="text-indigo-200 text-sm mb-2">Revenue</div>
                        <div className="text-2xl font-bold text-white">$12k</div>
                    </div>
                </div>
                
                {/* Branch Info Mini */}
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/5">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-neutral-700 text-white"><MapPin size={16}/></div>
                        <div>
                             <div className="text-sm font-bold text-white">Main HQ</div>
                             <div className="text-xs text-neutral-500">Tetouan, Morocco</div>
                        </div>
                     </div>
                </div>
             </GlassCard>
        </div>

        {/* C. CHART SECTION (Spans 8 columns) */}
        <div className="md:col-span-6 lg:col-span-8">
            <GlassCard title="Telemetry Analysis">
                <div className="h-[250px] w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barSize={30}>
                            <XAxis 
                                dataKey="type" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: "#737373", fontSize: 12 }} 
                                dy={10}
                            />
                            <Tooltip 
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '12px' }}
                            />
                            <Bar dataKey="count" radius={[6, 6, 6, 6]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#8b5cf6'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>
        </div>

        {/* D. LIST (Spans 4 columns) */}
        <div className="md:col-span-6 lg:col-span-4">
             <GlassCard title="Live Status" className="h-full">
                <div className="space-y-4">
                    {liveStatusList.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition border border-transparent hover:border-white/5">
                             <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                                     {item.driver.charAt(0)}
                                 </div>
                                 <div>
                                     <div className="text-sm font-bold text-white">{item.carNo}</div>
                                     <div className="text-xs text-neutral-500">{item.driver}</div>
                                 </div>
                             </div>
                             <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${item.statusColor}`}>
                                 {item.status}
                             </div>
                        </div>
                    ))}
                    <button className="w-full py-3 mt-2 text-sm text-neutral-400 hover:text-white border border-dashed border-neutral-700 hover:border-neutral-500 rounded-xl transition">
                        View All Activity
                    </button>
                </div>
             </GlassCard>
        </div>

      </div>
    </div>
  );
}

// Simple Helper for the Hero Card Stats
function StatBox({ label, value, icon: Icon }: any) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-neutral-400 text-xs">
                <Icon size={12} /> {label}
            </div>
            <div className="text-lg font-bold text-white">{value}</div>
        </div>
    );
}
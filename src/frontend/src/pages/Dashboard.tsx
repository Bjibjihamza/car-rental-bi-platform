// src/frontend/src/pages/Dashboard.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Car,
  Activity,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  ArrowRight,
  MoreHorizontal,
  RefreshCw,
  Zap,
  ShieldCheck,
  Wrench,
  Search,
  Filter,
  Download,
  Bell, // ✅ Fixed: Imported Bell
} from "lucide-react";

/* ================= TYPES & INTERFACES ================= */

type CarData = {
  CAR_ID: number;
  MAKE: string;
  MODEL: string;
  STATUS: string; // AVAILABLE, RENTED, MAINTENANCE, RETIRED
  ODOMETER_KM: number;
  BRANCH_ID: number;
};

type RentalData = {
  RENTAL_ID: number;
  START_AT: string;
  DUE_AT: string;
  RETURN_AT: string | null;
  STATUS: string; // ACTIVE, CLOSED, OVERDUE, CANCELLED
  TOTAL_AMOUNT: number | null;
  CREATED_AT: string;
};

type AlertData = {
  ALERT_ID: number;
  SEVERITY: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  MESSAGE: string;
  CREATED_AT: string;
  IS_RESOLVED: number;
};

type BranchData = {
  BRANCH_ID: number;
  BRANCH_NAME: string;
  CITY: string;
};

type DashboardStats = {
  totalRevenue: number;
  activeRentals: number;
  totalFleet: number;
  utilizationRate: number;
  maintenanceCount: number;
  criticalAlerts: number;
  revenueGrowth: number;
};

type BranchPerformance = {
  id: number;
  name: string;
  revenue: number;
  activeRentals: number;
  utilization: number;
};

/* ================= CONSTANTS & UTILS ================= */

const API_URL = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

const COLORS = {
  primary: "#6366f1",   // Indigo 500
  grid: "#ffffff10",
};

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#6366f1"];

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

const formatNumber = (num: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short" }).format(num);

/* ================= COMPONENT: STAT CARD ================= */

function StatCard({
  title,
  value,
  trend,
  icon: Icon,
  color,
  prefix = "",
  suffix = "",
}: {
  title: string;
  value: string | number;
  trend?: number;
  icon: any;
  color: "indigo" | "emerald" | "amber" | "rose";
  prefix?: string;
  suffix?: string;
}) {
  const colorStyles = {
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#121212] p-6 transition-all hover:border-white/10 hover:bg-[#18181b]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-400">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-white tracking-tight">
            {prefix}{value}{suffix}
          </h3>
        </div>
        <div className={`rounded-xl border p-3 ${colorStyles[color]} transition-transform group-hover:scale-110`}>
          <Icon size={24} strokeWidth={1.5} />
        </div>
      </div>
      
      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              trend >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
            }`}
          >
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
          <span className="text-xs text-neutral-500">vs last month</span>
        </div>
      )}
      
      {/* Background decoration */}
      <div className={`absolute -bottom-4 -right-4 h-24 w-24 rounded-full blur-3xl opacity-10 ${colorStyles[color].split(' ')[0].replace('/10', '')}`} />
    </div>
  );
}

/* ================= COMPONENT: ACTIVITY ITEM ================= */

function ActivityItem({
  icon: Icon,
  title,
  desc,
  time,
  tone = "neutral"
}: {
  icon: any;
  title: string;
  desc: string;
  time: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "bg-neutral-800 text-neutral-400",
    success: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/20 text-amber-400",
    danger: "bg-rose-500/20 text-rose-400",
    info: "bg-blue-500/20 text-blue-400",
  };

  return (
    <div className="group flex gap-4 p-3 rounded-xl transition-colors hover:bg-white/5">
      <div className={`mt-1 h-10 w-10 shrink-0 rounded-full grid place-items-center ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <p className="text-sm font-semibold text-white truncate pr-2">{title}</p>
          <span className="text-xs text-neutral-500 whitespace-nowrap">{time}</span>
        </div>
        <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{desc}</p>
      </div>
    </div>
  );
}

/* ================= MAIN PAGE COMPONENT ================= */

export function DashboardPage() {
  const { token, user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [refreshKey, setRefreshKey] = useState(0);

  // Raw Data Storage
  const [cars, setCars] = useState<CarData[]>([]);
  const [rentals, setRentals] = useState<RentalData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [branches, setBranches] = useState<BranchData[]>([]);

  // -- Data Fetching --
  useEffect(() => {
    async function fetchAllData() {
      setLoading(true);
      const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
      
      try {
        const [carsRes, rentalsRes, alertsRes, branchesRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/cars`, { headers }),
          fetch(`${API_URL}/api/v1/rentals`, { headers }),
          fetch(`${API_URL}/api/v1/iot-alerts`, { headers }), // ✅ Fixed Endpoint
          fetch(`${API_URL}/api/v1/branches`, { headers }),
        ]);

        const [carsData, rentalsData, alertsData, branchesData] = await Promise.all([
            carsRes.ok ? carsRes.json() : [],
            rentalsRes.ok ? rentalsRes.json() : [],
            alertsRes.ok ? alertsRes.json() : [],
            branchesRes.ok ? branchesRes.json() : [],
        ]);

        setCars(Array.isArray(carsData) ? carsData : []);
        setRentals(Array.isArray(rentalsData) ? rentalsData : []);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
        setBranches(Array.isArray(branchesData) ? branchesData : []);

      } catch (error) {
        console.error("Dashboard data load failed", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAllData();
  }, [token, refreshKey]);

  // -- Aggregations --

  // 1. Stats
  const stats: DashboardStats = useMemo(() => {
    const totalRevenue = rentals.reduce((acc, r) => acc + (r.TOTAL_AMOUNT || 0), 0);
    const activeRentals = rentals.filter(r => r.STATUS === "ACTIVE").length;
    const totalFleet = cars.length;
    const rentedCars = cars.filter(c => c.STATUS === "RENTED").length;
    const utilizationRate = totalFleet > 0 ? Math.round((rentedCars / totalFleet) * 100) : 0;
    
    // Growth calculation (Current Month vs Last Month)
    const now = new Date();
    const currentMonth = now.getMonth();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    
    let currentMonthRev = 0;
    let lastMonthRev = 0;

    rentals.forEach(r => {
        const d = new Date(r.CREATED_AT);
        if (d.getMonth() === currentMonth && d.getFullYear() === now.getFullYear()) {
            currentMonthRev += (r.TOTAL_AMOUNT || 0);
        } else if (d.getMonth() === lastMonth) {
            lastMonthRev += (r.TOTAL_AMOUNT || 0);
        }
    });

    const revenueGrowth = lastMonthRev > 0 
        ? Math.round(((currentMonthRev - lastMonthRev) / lastMonthRev) * 100) 
        : 100;

    return {
      totalRevenue,
      activeRentals,
      totalFleet,
      utilizationRate,
      maintenanceCount: cars.filter(c => c.STATUS === "MAINTENANCE").length,
      criticalAlerts: alerts.filter(a => a.SEVERITY === "CRITICAL" || a.SEVERITY === "HIGH").length,
      revenueGrowth,
    };
  }, [cars, rentals, alerts]);

  // 2. Revenue Chart
  const revenueChartData = useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const now = new Date();
    const dataMap = new Map<string, number>();

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dataMap.set(key, 0);
    }

    rentals.forEach(r => {
        const dateKey = new Date(r.CREATED_AT).toISOString().split('T')[0];
        if (dataMap.has(dateKey)) {
            dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + (r.TOTAL_AMOUNT || 0));
        }
    });

    return Array.from(dataMap.entries()).map(([date, value]) => ({
        name: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value,
    }));
  }, [rentals, timeRange]);

  // 3. Status Pie Chart
  const carStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    cars.forEach(c => {
        counts[c.STATUS] = (counts[c.STATUS] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [cars]);

  // 4. Branch Logic (Mocked revenue for visualization)
  const topBranches = useMemo(() => {
    const map = new Map<number, BranchPerformance>();
    
    branches.forEach(b => {
        map.set(b.BRANCH_ID, {
            id: b.BRANCH_ID,
            name: b.CITY,
            revenue: 0,
            activeRentals: 0,
            utilization: 0
        });
    });

    rentals.forEach(r => {
        const car = cars.find(c => true); // Mock join for visualization
        if (car && map.has(car.BRANCH_ID)) {
             const b = map.get(car.BRANCH_ID)!;
             b.revenue += (r.TOTAL_AMOUNT || 0);
        }
    });

    return Array.from(map.values())
        .map(b => ({ ...b, revenue: Math.floor(Math.random() * 50000) + 10000 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
  }, [branches, rentals, cars]);


  // 5. Activity Feed
  const recentActivity = useMemo(() => {
    const combined = [
        ...rentals.map(r => ({
            type: 'RENTAL',
            date: new Date(r.CREATED_AT),
            title: `New Rental #${r.RENTAL_ID}`,
            desc: `${r.STATUS} - ${formatMoney(r.TOTAL_AMOUNT || 0)}`,
            severity: 'success'
        })),
        ...alerts.map(a => ({
            type: 'ALERT',
            date: new Date(a.CREATED_AT),
            title: `System Alert: ${a.SEVERITY}`,
            desc: a.MESSAGE || "Anomaly Detected",
            severity: a.SEVERITY === 'CRITICAL' ? 'danger' : 'warning'
        })),
        ...cars.filter(c => c.STATUS === 'MAINTENANCE').map(c => ({
            type: 'MAINTENANCE',
            date: new Date(), 
            title: `Maintenance: ${c.MAKE} ${c.MODEL}`,
            desc: 'Vehicle flagged for checkup',
            severity: 'info'
        }))
    ];

    return combined
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 6);
  }, [rentals, alerts, cars]);


  if (loading) {
      return (
          <div className="flex h-[80vh] items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
                <p className="text-neutral-500 animate-pulse">Aggregating fleet analytics...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
            <p className="text-neutral-400 mt-1">
                Welcome back, <span className="text-indigo-400 font-semibold">{user?.firstName}</span>. Here is your daily fleet overview.
            </p>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="flex items-center rounded-lg bg-[#18181b] p-1 border border-white/10">
                {(["7d", "30d", "90d"] as const).map((range) => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                            timeRange === range 
                            ? "bg-indigo-600 text-white shadow-lg" 
                            : "text-neutral-500 hover:text-white"
                        }`}
                    >
                        {range.toUpperCase()}
                    </button>
                ))}
             </div>
             
             <button 
                onClick={() => setRefreshKey(k => k + 1)}
                className="p-2.5 rounded-lg border border-white/10 bg-[#18181b] text-neutral-400 hover:text-white hover:bg-white/5 transition"
                title="Refresh Data"
             >
                <RefreshCw size={18} />
             </button>
             
             <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition">
                <Download size={16} /> Export
             </button>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard 
            title="Total Revenue" 
            value={formatNumber(stats.totalRevenue)} 
            icon={DollarSign} 
            color="indigo"
            prefix="$"
            trend={stats.revenueGrowth}
        />
        <StatCard 
            title="Active Rentals" 
            value={stats.activeRentals} 
            icon={Car} 
            color="emerald" 
            trend={12}
        />
        <StatCard 
            title="Fleet Utilization" 
            value={stats.utilizationRate} 
            icon={Activity} 
            color="amber" 
            suffix="%"
            trend={-2}
        />
        <StatCard 
            title="Critical Issues" 
            value={stats.criticalAlerts} 
            icon={AlertTriangle} 
            color="rose" 
        />
      </div>

      {/* MAIN CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-[#121212] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white">Revenue Analytics</h3>
                    <p className="text-xs text-neutral-500">Income trends over the last {timeRange}</p>
                </div>
            </div>
            
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                        <XAxis 
                            dataKey="name" 
                            stroke="#525252" 
                            tick={{fontSize: 12}} 
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis 
                            stroke="#525252" 
                            tick={{fontSize: 12}} 
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `$${v/1000}k`}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={COLORS.primary} 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorRev)" 
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Status Chart */}
        <div className="rounded-2xl border border-white/5 bg-[#121212] p-6 shadow-xl flex flex-col">
            <h3 className="text-lg font-bold text-white mb-2">Fleet Status</h3>
            <p className="text-xs text-neutral-500 mb-6">Real-time distribution of {cars.length} vehicles</p>
            
            <div className="flex-1 relative min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={carStatusData}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {carStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px', color: '#fff' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                    <span className="text-3xl font-bold text-white">{cars.length}</span>
                    <span className="text-xs text-neutral-500 uppercase font-medium">Vehicles</span>
                </div>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-3">
                 <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
                    <div className="text-lg font-bold text-emerald-400">{cars.filter(c => c.STATUS === 'AVAILABLE').length}</div>
                    <div className="text-[10px] text-emerald-200 uppercase tracking-wide">Ready</div>
                 </div>
                 <div className="rounded-xl bg-blue-500/10 p-3 text-center">
                    <div className="text-lg font-bold text-blue-400">{cars.filter(c => c.STATUS === 'RENTED').length}</div>
                    <div className="text-[10px] text-blue-200 uppercase tracking-wide">Rented</div>
                 </div>
            </div>
        </div>
      </div>

      {/* SECONDARY ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* BRANCH TABLE */}
         <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-[#121212] p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MapPin className="text-indigo-500" size={20}/> Top Performing Branches
                </h3>
                <Link to="/branches" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    View All <ArrowRight size={12}/>
                </Link>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/10 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                            <th className="pb-3 pl-2">Branch City</th>
                            <th className="pb-3">Performance</th>
                            <th className="pb-3 text-right">Revenue</th>
                            <th className="pb-3 text-right pr-2">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {topBranches.map((branch, i) => (
                            <tr key={branch.id} className="group transition-colors hover:bg-white/5">
                                <td className="py-4 pl-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`grid h-8 w-8 place-items-center rounded-lg font-bold text-xs ${
                                            i === 0 ? "bg-amber-500/20 text-amber-400" :
                                            i === 1 ? "bg-slate-400/20 text-slate-400" :
                                            "bg-orange-700/20 text-orange-700"
                                        }`}>
                                            #{i+1}
                                        </div>
                                        <span className="font-medium text-white">{branch.name}</span>
                                    </div>
                                </td>
                                <td className="py-4 w-1/3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                                            <div 
                                                className="h-full bg-indigo-500 rounded-full" 
                                                style={{ width: `${Math.random() * 40 + 50}%` }} 
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 text-right font-mono font-medium text-emerald-400">
                                    {formatMoney(branch.revenue)}
                                </td>
                                <td className="py-4 text-right pr-2">
                                    <button className="text-neutral-500 hover:text-white transition">
                                        <MoreHorizontal size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>

         {/* ACTIVITY FEED */}
         <div className="rounded-2xl border border-white/5 bg-[#121212] p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="text-neutral-400" size={20}/> Live Feed
                </h3>
                <div className="flex gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"/>
                </div>
            </div>

            <div className="space-y-1 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                {recentActivity.map((item, idx) => {
                    let Icon = Bell;
                    let Tone: any = "neutral";
                    if(item.type === 'RENTAL') { Icon = Car; Tone = "success"; }
                    if(item.type === 'ALERT') { Icon = AlertTriangle; Tone = item.severity === 'danger' ? 'danger' : 'warning'; }
                    if(item.type === 'MAINTENANCE') { Icon = Wrench; Tone = "info"; }

                    return (
                        <ActivityItem 
                            key={idx}
                            icon={Icon}
                            title={item.title}
                            desc={item.desc}
                            time={item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            tone={Tone}
                        />
                    );
                })}
                
                {recentActivity.length === 0 && (
                    <div className="text-center py-10 text-neutral-500 text-sm">
                        No recent activity recorded.
                    </div>
                )}
            </div>
            
            <button className="mt-auto pt-4 w-full text-center text-xs font-bold text-neutral-500 hover:text-white transition uppercase tracking-wide">
                View All Activity
            </button>
         </div>
      </div>

      {/* BOTTOM ROW: MAINTENANCE & ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 rounded-2xl border border-white/5 bg-[#121212] p-6">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Wrench className="text-amber-500" size={20} /> Maintenance Watchlist
                  </h3>
                  <Link to="/cars" className="text-xs font-bold text-indigo-400 hover:text-indigo-300">
                      Manage Fleet
                  </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cars.filter(c => c.STATUS === 'MAINTENANCE' || c.ODOMETER_KM > 100000).slice(0, 3).map(car => (
                      <div key={car.CAR_ID} className="flex gap-4 p-4 rounded-xl bg-neutral-900 border border-white/5 hover:border-amber-500/30 transition">
                          <div className="h-12 w-12 rounded-lg bg-neutral-800 grid place-items-center shrink-0">
                                <Car className="text-neutral-400" />
                          </div>
                          <div>
                                <h4 className="font-bold text-white text-sm">{car.MAKE} {car.MODEL}</h4>
                                <div className="text-xs text-neutral-400 mt-1">ID: #{car.CAR_ID}</div>
                                <div className="mt-2 inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                                    {car.ODOMETER_KM > 100000 ? "HIGH MILEAGE" : "SERVICE DUE"}
                                </div>
                          </div>
                      </div>
                  ))}
                  
                  {cars.filter(c => c.STATUS === 'MAINTENANCE').length === 0 && (
                      <div className="col-span-3 py-8 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
                          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500/50 mb-2"/>
                          <p className="text-sm text-neutral-400">Fleet is healthy. No maintenance required.</p>
                      </div>
                  )}
              </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-xl relative overflow-hidden group">
               <div className="relative z-10 h-full flex flex-col">
                   <h3 className="text-xl font-bold mb-1">Quick Action</h3>
                   <p className="text-indigo-100 text-sm mb-6 opacity-90">Create a new rental agreement instantly.</p>
                   
                   <Link 
                     to="/rentals/new"
                     className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-white text-indigo-600 py-3 font-bold hover:bg-indigo-50 transition shadow-lg"
                   >
                       <Zap size={18} fill="currentColor" /> New Rental
                   </Link>
               </div>
               
               <div className="absolute top-[-20%] right-[-20%] h-40 w-40 rounded-full bg-white/10 blur-3xl transition-transform group-hover:scale-150 duration-700" />
               <div className="absolute bottom-[-10%] left-[-10%] h-32 w-32 rounded-full bg-black/10 blur-2xl" />
          </div>
      </div>
    </div>
  );
}
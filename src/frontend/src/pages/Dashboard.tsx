import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Wallet,
  Bell,
  Car,
  Wrench,
  Gauge,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Users,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Circle,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const API_URL = "http://localhost:8000";

type DashboardOverview = {
  today: {
    rentals: number;
    revenueMAD: number;
    alertsOpen: number;
    activeRentalsNow: number;
  };
  fleet: {
    total: number;
    available: number;
    rented: number;
    maintenance: number;
  };
  source?: "GOLD" | "SILVER";
};

type DailyPoint = {
  DATE_KEY: number;
  FULL_DATE: string;
  VALUE: number;
};

async function apiGet<T>(url: string): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const MetricCard = ({ icon: Icon, label, value, change, trend, color, subtitle, isLoading }) => {
  const isPositive = trend === "up";
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-sm transition-all hover:border-white/20 hover:shadow-2xl hover:shadow-indigo-500/10">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-3xl" />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className={`rounded-xl bg-gradient-to-br ${color} p-3 shadow-lg`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          
          {change && !isLoading && (
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`}>
              <TrendIcon className="h-3 w-3" />
              {change}%
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-neutral-400">{label}</div>
          {isLoading ? (
            <div className="mt-1 h-8 w-24 animate-pulse rounded bg-white/10" />
          ) : (
            <>
              <div className="mt-1 text-3xl font-bold text-white">{value}</div>
              {subtitle && <div className="mt-1 text-xs text-neutral-500">{subtitle}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const GlowingCard = ({ title, subtitle, children, className = "", icon: Icon }) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#121212] p-6 shadow-2xl ${className}`}>
      <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
      
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5 text-indigo-400" />}
              <h3 className="text-lg font-bold text-white">{title}</h3>
            </div>
            {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};

const StatBadge = ({ icon: Icon, label, value, color = "blue" }) => {
  const colors = {
    blue: "from-blue-500 to-cyan-500",
    green: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    purple: "from-purple-500 to-pink-500",
    red: "from-red-500 to-rose-500",
    gray: "from-gray-500 to-slate-500",
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <div className={`rounded-lg bg-gradient-to-br ${colors[color]} p-2`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <div className="text-xs text-neutral-400">{label}</div>
        <div className="text-sm font-bold text-white">{value}</div>
      </div>
    </div>
  );
};

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [rentalsData, setRentalsData] = useState<DailyPoint[]>([]);
  const [alertsData, setAlertsData] = useState<DailyPoint[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [overviewRes, rentalsRes, alertsRes] = await Promise.all([
        apiGet<DashboardOverview>(`${API_URL}/api/v1/analytics/dashboard/overview`),
        apiGet<DailyPoint[]>(`${API_URL}/api/v1/analytics/kpi/rentals-daily?days=${timeRange}`),
        apiGet<DailyPoint[]>(`${API_URL}/api/v1/analytics/kpi/alerts-daily?days=${timeRange}`),
      ]);

      setOverview(overviewRes);
      setRentalsData(Array.isArray(rentalsRes) ? rentalsRes : []);
      setAlertsData(Array.isArray(alertsRes) ? alertsRes : []);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const rentalsChartData = useMemo(() => {
    return rentalsData.map(p => ({
      date: String(p.FULL_DATE || "").slice(5),
      rentals: Number(p.VALUE || 0),
    }));
  }, [rentalsData]);

  const alertsChartData = useMemo(() => {
    return alertsData.map(p => ({
      date: String(p.FULL_DATE || "").slice(5),
      alerts: Number(p.VALUE || 0),
    }));
  }, [alertsData]);

  const fleetStatus = useMemo(() => {
    if (!overview) return [];
    return [
      { name: "Available", value: overview.fleet.available, color: "#10b981" },
      { name: "Rented", value: overview.fleet.rented, color: "#3b82f6" },
      { name: "Maintenance", value: overview.fleet.maintenance, color: "#f59e0b" },
    ].filter(item => item.value > 0);
  }, [overview]);

  const utilizationRate = useMemo(() => {
    if (!overview?.fleet.total) return 0;
    return Math.round((overview.fleet.rented / overview.fleet.total) * 100);
  }, [overview]);

  const performanceData = useMemo(() => {
    if (!overview) return [];
    const util = utilizationRate;
    return [
      { metric: "Utilization", value: util },
      { metric: "Fleet Health", value: overview.fleet.maintenance === 0 ? 100 : Math.max(0, 100 - (overview.fleet.maintenance / overview.fleet.total) * 100) },
      { metric: "Active Ops", value: overview.today.activeRentalsNow > 0 ? 90 : 50 },
      { metric: "Alert Status", value: overview.today.alertsOpen === 0 ? 100 : Math.max(0, 100 - overview.today.alertsOpen * 10) },
      { metric: "Revenue Flow", value: overview.today.revenueMAD > 0 ? 85 : 40 },
    ];
  }, [overview, utilizationRate]);

  const fmtMAD = (v: number) => {
    return new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency: "MAD",
      maximumFractionDigits: 0,
    }).format(v);
  };

  if (loading && !overview) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-500/30 border-t-indigo-500 mx-auto" />
          <p className="mt-4 text-neutral-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Dashboard</h2>
          <p className="text-neutral-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Fleet Command Center</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Real-time analytics powered by{" "}
              <span className={`font-bold ${overview?.source === "GOLD" ? "text-amber-400" : "text-blue-400"}`}>
                {overview?.source || "GOLD"}
              </span>{" "}
              layer
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days as 7 | 30 | 90)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    timeRange === days
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="Revenue Today"
            value={overview ? fmtMAD(overview.today.revenueMAD) : "—"}
            change={12.5}
            trend="up"
            color="from-emerald-500 to-teal-500"
            subtitle="Gross daily revenue"
            isLoading={loading}
          />
          <MetricCard
            icon={Activity}
            label="Rentals Today"
            value={overview?.today.rentals.toString() || "—"}
            change={8.2}
            trend="up"
            color="from-blue-500 to-cyan-500"
            subtitle="Daily rental count"
            isLoading={loading}
          />
          <MetricCard
            icon={Car}
            label="Active Now"
            value={overview?.today.activeRentalsNow.toString() || "—"}
            color="from-purple-500 to-pink-500"
            subtitle="Currently on road"
            isLoading={loading}
          />
          <MetricCard
            icon={Bell}
            label="Open Alerts"
            value={overview?.today.alertsOpen.toString() || "—"}
            change={overview?.today.alertsOpen === 0 ? undefined : 15.4}
            trend="down"
            color="from-amber-500 to-orange-500"
            subtitle="Needs attention"
            isLoading={loading}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <GlowingCard title="Fleet Distribution" subtitle="Current vehicle status" className="lg:col-span-1" icon={PieChartIcon}>
            {fleetStatus.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-neutral-500">
                No fleet data
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={fleetStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {fleetStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a1a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {fleetStatus.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <Circle className="h-3 w-3" fill={item.color} color={item.color} />
                      <span className="text-xs text-neutral-400">{item.name}</span>
                      <span className="ml-auto text-sm font-bold text-white">{item.value}</span>
                    </div>
                  ))}
                  <div className="col-span-2 mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Total Fleet</span>
                      <span className="text-sm font-bold text-white">{overview?.fleet.total || 0}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </GlowingCard>

          <GlowingCard title="Performance Metrics" subtitle="Multi-dimensional health check" className="lg:col-span-2" icon={BarChart3}>
            {performanceData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-neutral-500">
                No performance data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={performanceData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#9ca3af" }} />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </GlowingCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlowingCard title="Rentals Trend" subtitle={`Last ${timeRange} days`} icon={LineChartIcon}>
            {rentalsChartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-neutral-500">
                No rental data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={rentalsChartData}>
                  <defs>
                    <linearGradient id="rentalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rentals"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="url(#rentalGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlowingCard>

          <GlowingCard title="Alerts Distribution" subtitle={`Last ${timeRange} days`} icon={Bell}>
            {alertsChartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-neutral-500">
                No alerts data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={alertsChartData}>
                  <defs>
                    <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="alerts" fill="url(#alertGradient)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlowingCard>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <StatBadge icon={Car} label="Total Fleet" value={overview?.fleet.total.toString() || "0"} color="blue" />
          <StatBadge icon={Gauge} label="Available" value={overview?.fleet.available.toString() || "0"} color="green" />
          <StatBadge icon={TrendingUp} label="Rented" value={overview?.fleet.rented.toString() || "0"} color="purple" />
          <StatBadge icon={Wrench} label="Maintenance" value={overview?.fleet.maintenance.toString() || "0"} color="amber" />
          <StatBadge icon={Zap} label="Utilization" value={`${utilizationRate}%`} color={utilizationRate >= 70 ? "green" : "gray"} />
          <StatBadge icon={Users} label="Active Ops" value={overview?.today.activeRentalsNow.toString() || "0"} color="blue" />
        </div>

        <div className="text-xs text-neutral-600 flex items-center justify-between">
          <span>
            Analytics Source: <strong className={overview?.source === "GOLD" ? "text-amber-400" : "text-blue-400"}>{overview?.source || "GOLD"}</strong> layer
            {overview?.source === "SILVER" && " (fallback mode - GOLD unavailable)"}
          </span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
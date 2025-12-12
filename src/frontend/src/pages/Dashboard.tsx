import { Card } from "../components/Card";
import { SpecCard } from "../components/SpecCard";
import { cars, telemetry } from "../data/mock"; // Ensure this path matches your project
import {
  Gauge,
  Zap,
  Droplet,
  Settings,
  Car as CarIcon,
  MoreHorizontal,
  CalendarDays,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// --- MOCK DATA FOR VISUALS ---
const featuredCar = {
  name: "Nissan GTR",
  model: "Evoque",
  image: "https://images.unsplash.com/photo-1580273916550-e323be2ed5d6?auto=format&fit=crop&q=80&w=1000", // Generic blue SUV
  price: "$38,700",
  specs: {
    engine: "3745 cc",
    power: "641 BHP",
    transmission: "6 Speed",
    cylinders: "4 Inline",
    battery: "1997 CC",
    speed: "246.74",
    run: "9,245 Km",
  },
};

// Formatting telemetry for the bottom right chart
const chartData = Object.entries(
  telemetry.reduce<Record<string, number>>((acc, t) => {
    acc[t.eventType] = (acc[t.eventType] ?? 0) + 1;
    return acc;
  }, {})
).map(([k, v]) => ({ type: k, count: v * 10 })); // Scaling up for visuals

export function DashboardPage() {
  // --- FIXED DATA MAPPING ---
  // We added `|| {}` and `|| "XXXX"` to prevent crashes if data is missing
  const liveStatusList = (cars || []).slice(0, 4).map((car, index) => ({
    no: `#${index + 1}`,
    carNo: (car.licensePlate || "AB-8888").slice(-4), // SAFETY FIX HERE
    driver: ["Rober Hoak", "Daniyel Dam", "Faizan Finy", "Elion Musk"][index] || "Unknown",
    status: car.status === "AVAILABLE" ? "In Route" : car.status === "MAINTENANCE" ? "Pending" : "Completed",
    earning: "$35.44",
    statusColor: car.status === "AVAILABLE" ? "bg-blue-500" : car.status === "MAINTENANCE" ? "bg-emerald-500" : "bg-orange-500",
  }));

  return (
    <div className="space-y-8 pb-10">
      {/* Header text */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, Elion!</h1>
        <p className="text-slate-500">Today is a great day for car rental service</p>
      </div>

      {/* 1. TOP SPECS GRID */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SpecCard
          label="Engine"
          value={featuredCar.specs.engine}
          subValue="3.0L"
          theme="orange"
          icon={<Zap className="h-6 w-6" />}
        />
        <SpecCard
          label="Power Output"
          value={featuredCar.specs.power}
          theme="blue"
          icon={<Gauge className="h-6 w-6" />}
        />
        <SpecCard
          label="Transmission"
          value={featuredCar.specs.transmission}
          subValue="TC-SST"
          theme="yellow"
          icon={<Droplet className="h-6 w-6" />}
        />
        <SpecCard
          label="Cylinder"
          value={featuredCar.specs.cylinders}
          theme="purple"
          icon={<Settings className="h-6 w-6" />}
        />
      </div>

      {/* 2. MIDDLE SECTION: Featured Car + Calendar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Featured Car Main Card */}
        <Card className="lg:col-span-2 relative overflow-hidden">
          <div className="flex flex-col xl:flex-row gap-8">
            {/* Car Info & Image Side */}
            <div className="flex-1 space-y-6 z-10">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <CarIcon className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{featuredCar.name}</h2>
                  <p className="text-slate-500">{featuredCar.model}</p>
                </div>
              </div>

              <img
                src={featuredCar.image}
                alt="Car"
                className="w-full max-w-[400px] object-cover rounded-xl mx-auto shadow-xl transform hover:scale-105 transition-transform duration-300"
              />

              <div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Asking Price</p>
                <p className="text-3xl font-black text-slate-900">
                  {featuredCar.price} <span className="text-lg font-medium text-slate-500">USD</span>
                </p>
              </div>
            </div>

            {/* Right Side: 2x2 Specs Grid */}
            <div className="flex-1 grid grid-cols-2 gap-4 content-center">
              <SpecCard label="Battery" value={featuredCar.specs.battery} theme="orange" icon={<Zap className="h-5 w-5" />} />
              <SpecCard label="Speed" value={featuredCar.specs.speed} theme="blue" icon={<Gauge className="h-5 w-5" />} />
              <SpecCard label="Speed" value={featuredCar.specs.transmission} theme="yellow" icon={<Droplet className="h-5 w-5" />} />
              <SpecCard label="Cylinder" value={featuredCar.specs.cylinders} theme="purple" icon={<Settings className="h-5 w-5" />} />

              <div className="col-span-2 mt-4 flex items-center justify-center gap-2 rounded-2xl bg-indigo-50 py-3 text-indigo-700 font-semibold">
                <CarIcon className="h-5 w-5" /> Total Run: {featuredCar.specs.run}
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Calendar Placeholder */}
        <Card title="August, 2023" right={<CalendarDays className="text-slate-400" />}>
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl mb-6">
            <button className="flex-1 py-2 text-sm font-medium text-slate-600">Week</button>
            <button className="flex-1 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg shadow-sm">Month</button>
          </div>

          <div className="grid grid-cols-7 gap-y-4 text-center text-sm text-slate-600 font-medium">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-xs text-slate-400 mb-2">{d}</div>
            ))}
            {[...Array(30)].map((_, i) => {
              const day = i + 1;
              const isSelected = day === 16;
              return (
                <div
                  key={i}
                  className={`aspect-square flex items-center justify-center rounded-full ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-200"
                      : "hover:bg-slate-100 cursor-pointer"
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 3. BOTTOM SECTION: List & Chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live Car Status Table */}
        <Card
          title="Live Car Status"
          right={
            <button className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700">
              <Settings className="h-4 w-4" /> Filter
            </button>
          }
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm font-medium text-slate-400 border-b border-slate-100">
                  <th className="pb-4 font-medium">No.</th>
                  <th className="pb-4 font-medium">Car No.</th>
                  <th className="pb-4 font-medium">Driver</th>
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Earning</th>
                  <th className="pb-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {liveStatusList.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-50 last:border-0 font-medium text-slate-700">
                    <td className="py-4">{item.no}</td>
                    <td className="py-4 font-bold">{item.carNo}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 overflow-hidden">
                          {item.driver.charAt(0)}
                        </div>
                        {item.driver}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${item.statusColor}`}></div>
                        {item.status}
                      </div>
                    </td>
                    <td className="py-4 font-bold">{item.earning}</td>
                    <td className="py-4 text-right">
                      <button className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition">
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Tracking History Chart */}
        <Card title="Tracking History" right={<MoreHorizontal className="text-slate-400" />}>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="type"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  dy={10}
                  tickFormatter={(val) => val.substring(0, 3)}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.2)",
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[12, 12, 12, 12]} background={{ fill: "#f1f5f9", radius: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
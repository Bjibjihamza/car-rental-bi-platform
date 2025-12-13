import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { Activity, Zap, Thermometer, MapPin, Navigation } from "lucide-react";

const API_URL = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

type LiveSignal = {
  DEVICE_ID: number;
  CAR_ID: number;
  MAKE: string;
  MODEL: string;
  LICENSE_PLATE: string;
  SPEED_KMH: number;
  FUEL_LEVEL_PCT: number;
  ENGINE_TEMP_C: number;
  EVENT_TYPE: string;
  LATITUDE: number;
  LONGITUDE: number;
  RECEIVED_AT: string;
};

export function LiveMonitor() {
  const { token } = useAuth();
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Polling Function
  const fetchLive = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/iot-telemetry/live`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSignals(data);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Poll every 3 seconds
  useEffect(() => {
    fetchLive(); // Initial fetch
    const interval = setInterval(fetchLive, 3000);
    return () => clearInterval(interval);
  }, [token]);

  // Derived Stats
  // FIX: Renamed variable from 'active cars' to 'activeCars'
  const activeCars = new Set(signals.map(s => s.CAR_ID)).size;
  
  const avgSpeed = signals.length > 0 
    ? (signals.reduce((acc, curr) => acc + curr.SPEED_KMH, 0) / signals.length).toFixed(1) 
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-500/20 text-green-400">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-neutral-400">Incoming Signals (30s)</p>
            <h3 className="text-2xl font-bold text-white">{signals.length}</h3>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400">
            <Navigation size={24} />
          </div>
          <div>
            <p className="text-sm text-neutral-400">Active Vehicles</p>
            {/* FIX: Updated usage here */}
            <h3 className="text-2xl font-bold text-white">{activeCars}</h3>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-orange-500/20 text-orange-400">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-sm text-neutral-400">Avg Fleet Speed</p>
            <h3 className="text-2xl font-bold text-white">{avgSpeed} <span className="text-sm font-normal text-neutral-500">km/h</span></h3>
          </div>
        </div>
      </div>

      {/* Live Feed Table */}
      <Card 
        title="Real-Time Telemetry Feed" 
        subtitle={`Live ingestion stream • Updated: ${lastUpdate.toLocaleTimeString()}`}
        className="min-h-[500px]"
      >
        <div className="overflow-hidden">
          <DataTable 
            rows={signals}
            cols={[
              { 
                key: "RECEIVED_AT", 
                header: "Time", 
                render: (r) => <span className="text-xs font-mono text-neutral-400">{new Date(r.RECEIVED_AT).toLocaleTimeString()}</span> 
              },
              { 
                key: "CAR", 
                header: "Vehicle", 
                render: (r) => (
                  <div>
                    <div className="font-bold text-white text-sm">{r.LICENSE_PLATE}</div>
                    <div className="text-xs text-neutral-500">{r.MAKE} {r.MODEL}</div>
                  </div>
                ) 
              },
              { 
                key: "EVENT", 
                header: "Event", 
                render: (r) => {
                  const tone = r.EVENT_TYPE === "DRIVING" ? "blue" : r.EVENT_TYPE === "IDLE" ? "amber" : "gray";
                  return <Badge tone={tone}>{r.EVENT_TYPE}</Badge>
                }
              },
              { 
                key: "SPEED", 
                header: "Speed", 
                render: (r) => <span className={`font-mono font-bold ${r.SPEED_KMH > 100 ? 'text-red-400' : 'text-white'}`}>{r.SPEED_KMH.toFixed(0)} km/h</span> 
              },
              { 
                key: "FUEL", 
                header: "Fuel/Bat", 
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${r.FUEL_LEVEL_PCT}%` }} />
                    </div>
                    <span className="text-xs text-neutral-400">{r.FUEL_LEVEL_PCT.toFixed(0)}%</span>
                  </div>
                ) 
              },
              { 
                key: "TEMP", 
                header: "Engine Temp", 
                render: (r) => (
                  <div className="flex items-center gap-1 text-xs text-neutral-400">
                    <Thermometer size={12}/> {r.ENGINE_TEMP_C.toFixed(0)}°C
                  </div>
                ) 
              },
              { 
                key: "LOC", 
                header: "Location", 
                render: (r) => (
                  <a 
                    href={`http://maps.google.com/?q=${r.LATITUDE},${r.LONGITUDE}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    <MapPin size={12}/> View Map
                  </a>
                ) 
              },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
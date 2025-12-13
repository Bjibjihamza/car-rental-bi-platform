import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Badge } from "../components/Badge";
import { 
  LayoutGrid, List, RefreshCw, Plus, X, 
  Car as CarIcon, MapPin, Gauge, Search,
  Activity // New icon for active status
} from "lucide-react";

/* ================= TYPES ================= */
export type CarRow = {
  CAR_ID: number;
  CATEGORY_ID: number;
  DEVICE_ID: number | null;
  VIN: string;
  LICENSE_PLATE: string;
  MAKE: string;
  MODEL: string;
  MODEL_YEAR: number;
  COLOR: string;
  IMAGE_URL?: string | null;
  ODOMETER_KM: number;
  STATUS: string;
  BRANCH_ID: number | null;
  CREATED_AT: string;
  BRANCH_CITY?: string | null;
};

type BranchRow = { BRANCH_ID: number; BRANCH_NAME: string; CITY: string; };
type DeviceOption = { DEVICE_ID: number; DEVICE_CODE: string; };

/* ================= HELPERS ================= */
const API_URL = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

const CATEGORIES: Record<number, string> = { 1: "City", 2: "SUV", 3: "Luxury", 4: "Van", 5: "EV" };

function fmtKm(n: number) { return new Intl.NumberFormat().format(n) + " km"; }
function categoryLabel(id: number) { return CATEGORIES[id] || `#${id}`; }

// Updated Badge Tone to handle "DRIVING"
function badgeTone(status: string) {
  const map: Record<string, "green" | "blue" | "amber" | "gray" | "purple" | "red" | "indigo"> = {
    AVAILABLE: "green", 
    RENTED: "blue", 
    MAINTENANCE: "amber", 
    RETIRED: "gray", 
    RESERVED: "purple",
    DRIVING: "indigo" // [NEW] Special color for active cars
  };
  return map[status.toUpperCase()] || "red";
}

/* ================= SUB-COMPONENT: CAR DRAWER ================= */
function CarDetailsDrawer({ car, onClose }: { car: CarRow | null, onClose: () => void }) {
  if (!car) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="h-full w-full max-w-md border-l border-white/10 bg-[#09090b] shadow-2xl animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-[#121212]">
          <h2 className="text-lg font-bold text-white">Vehicle Details</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10 text-neutral-400 hover:text-white"><X size={20}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Car Image Header */}
          <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg bg-neutral-900">
            {car.IMAGE_URL ? (
              <img src={car.IMAGE_URL} className="w-full h-56 object-cover" alt={car.MODEL} />
            ) : (
              <div className="h-56 grid place-items-center text-neutral-500"><CarIcon size={48} /></div>
            )}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <h3 className="text-2xl font-bold text-white">{car.MAKE} {car.MODEL}</h3>
              <div className="text-neutral-300 text-sm">{car.MODEL_YEAR} • {categoryLabel(car.CATEGORY_ID)}</div>
            </div>
          </div>

          <div className="flex gap-2">
             <div className="flex-1 rounded-xl bg-white/5 p-3 border border-white/5 text-center">
                <div className="text-xs text-neutral-500 uppercase tracking-wide">Status</div>
                <div className="mt-1 flex justify-center"><Badge tone={badgeTone(car.STATUS)}>{car.STATUS}</Badge></div>
             </div>
             <div className="flex-1 rounded-xl bg-white/5 p-3 border border-white/5 text-center">
                <div className="text-xs text-neutral-500 uppercase tracking-wide">Plate</div>
                <div className="mt-1 font-mono text-white font-bold">{car.LICENSE_PLATE}</div>
             </div>
          </div>

          {/* IoT Telemetry Section */}
          <div className="rounded-xl bg-indigo-500/10 p-5 border border-indigo-500/20 relative overflow-hidden">
            <div className="relative z-10">
                <h4 className="text-sm font-bold text-indigo-300 mb-1 flex items-center gap-2"><Gauge size={14}/> IoT Telemetry</h4>
                <p className="text-xs text-indigo-200/60 mb-3">Device ID: {car.DEVICE_ID ? `#${car.DEVICE_ID}` : "Not Linked"}</p>
                {car.STATUS === 'DRIVING' ? (
                  <div className="flex items-center gap-2 text-xs text-indigo-200 font-bold">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                    Live Driving Detected
                  </div>
                ) : (
                   <div className="text-xs text-neutral-500">No active signal</div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= SUB-COMPONENT: CREATE MODAL ================= */
function CreateCarModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [categories, setCategories] = useState<{CATEGORY_ID: number, CATEGORY_NAME: string}[]>([]);

  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  
  const [form, setForm] = useState({
    CATEGORY_ID: "", 
    BRANCH_ID: user?.branchId || "", 
    DEVICE_ID: "",
    VIN: "", 
    LICENSE_PLATE: "",
    MAKE: "", 
    MODEL: "", 
    MODEL_YEAR: new Date().getFullYear(),
    COLOR: "", 
    IMAGE_URL: "", 
    ODOMETER_KM: 0, 
    STATUS: "AVAILABLE"
  });

  useEffect(() => {
    if (!isOpen) return;
    const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
    
    Promise.all([
      fetch(`${API_URL}/api/v1/branches`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/v1/devices/available`, { headers }).then(r => r.json()),
      fetch(`${API_URL}/api/v1/categories`, { headers }).then(r => r.json())
    ]).then(([bData, dData, cData]) => {
      if(Array.isArray(bData)) setBranches(bData);
      if(Array.isArray(dData)) setDevices(dData);
      if(Array.isArray(cData)) setCategories(cData);
    }).catch(console.error);
  }, [isOpen, token]);

  async function handleAddCategory() {
    if(!newCatName.trim()) return;
    setCatLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ CATEGORY_NAME: newCatName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setCategories(prev => [...prev, data]);
      setForm(prev => ({ ...prev, CATEGORY_ID: String(data.CATEGORY_ID) }));
      setIsAddingCat(false);
      setNewCatName("");
    } catch (e) { alert("Error adding category"); } 
    finally { setCatLoading(false); }
  }

  async function handleSubmit() {
    if (!form.CATEGORY_ID || !form.BRANCH_ID || !form.VIN || !form.MAKE) {
        alert("Please fill in all required fields");
        return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        CATEGORY_ID: Number(form.CATEGORY_ID),
        BRANCH_ID: Number(form.BRANCH_ID),
        DEVICE_ID: form.DEVICE_ID ? Number(form.DEVICE_ID) : null,
        IMAGE_URL: form.IMAGE_URL.trim() || null,
      };
      const res = await fetch(`${API_URL}/api/v1/cars`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create");
      onSuccess();
      onClose();
    } catch (e) { alert("Error creating car"); } 
    finally { setLoading(false); }
  }

  if (!isOpen) return null;

  const InputClass = "w-full rounded-xl bg-neutral-900 border border-white/10 px-3 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition";
  const LabelClass = "text-xs text-neutral-400 font-medium ml-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#18181b]">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CarIcon className="text-indigo-500" size={20}/> Add New Vehicle
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1 md:col-span-2 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-[-10px]">Assignments</div>
            <div className="space-y-1">
               <label className={LabelClass}>Branch <span className="text-red-500">*</span></label>
               <select className={InputClass} value={form.BRANCH_ID} onChange={e => setForm({...form, BRANCH_ID: e.target.value})}>
                 <option value="">-- Select Branch --</option>
                 {branches.map(b => (
                   <option key={b.BRANCH_ID} value={b.BRANCH_ID}>{b.CITY} - {b.BRANCH_NAME}</option>
                 ))}
               </select>
            </div>
            <div className="space-y-1">
               <label className={LabelClass}>Category <span className="text-red-500">*</span></label>
               {isAddingCat ? (
                 <div className="flex gap-2">
                    <input className={InputClass} placeholder="New Category Name..." autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                    <button onClick={handleAddCategory} disabled={catLoading} className="px-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-xs">{catLoading ? "..." : "SAVE"}</button>
                    <button onClick={() => setIsAddingCat(false)} className="px-3 rounded-lg bg-neutral-700 text-white hover:bg-neutral-600 text-xs">X</button>
                 </div>
               ) : (
                 <div className="flex gap-2">
                   <select className={InputClass} value={form.CATEGORY_ID} onChange={e => setForm({...form, CATEGORY_ID: e.target.value})}>
                     <option value="">-- Select Category --</option>
                     {categories.map(c => <option key={c.CATEGORY_ID} value={c.CATEGORY_ID}>{c.CATEGORY_NAME}</option>)}
                   </select>
                   <button onClick={() => setIsAddingCat(true)} className="aspect-square h-[42px] flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition"><Plus size={18} /></button>
                 </div>
               )}
            </div>
            <div className="col-span-1 md:col-span-2 text-xs font-bold text-indigo-400 uppercase tracking-wider mt-2 mb-[-10px]">Details</div>
            <div className="space-y-1"><label className={LabelClass}>Make</label><input className={InputClass} value={form.MAKE} onChange={e => setForm({...form, MAKE: e.target.value})} placeholder="Toyota" /></div>
            <div className="space-y-1"><label className={LabelClass}>Model</label><input className={InputClass} value={form.MODEL} onChange={e => setForm({...form, MODEL: e.target.value})} placeholder="Camry" /></div>
            <div className="space-y-1"><label className={LabelClass}>VIN</label><input className={InputClass} value={form.VIN} onChange={e => setForm({...form, VIN: e.target.value})} placeholder="17 chars" /></div>
            <div className="space-y-1"><label className={LabelClass}>Plate</label><input className={InputClass} value={form.LICENSE_PLATE} onChange={e => setForm({...form, LICENSE_PLATE: e.target.value})} placeholder="1234-A-1" /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className={LabelClass}>Year</label><input type="number" className={InputClass} value={form.MODEL_YEAR} onChange={e => setForm({...form, MODEL_YEAR: Number(e.target.value)})} /></div>
                <div className="space-y-1"><label className={LabelClass}>Color</label><input className={InputClass} value={form.COLOR} onChange={e => setForm({...form, COLOR: e.target.value})} placeholder="Silver" /></div>
            </div>
            <div className="space-y-1"><label className={LabelClass}>Odometer (KM)</label><input type="number" className={InputClass} value={form.ODOMETER_KM} onChange={e => setForm({...form, ODOMETER_KM: Number(e.target.value)})} /></div>
            <div className="col-span-1 md:col-span-2 text-xs font-bold text-indigo-400 uppercase tracking-wider mt-2 mb-[-10px]">Tech & Media</div>
            <div className="space-y-1">
               <label className={LabelClass}>Link IoT Device</label>
               <select className={InputClass} value={form.DEVICE_ID} onChange={e => setForm({...form, DEVICE_ID: e.target.value})}>
                 <option value="">No Device</option>
                 {devices.map(d => <option key={d.DEVICE_ID} value={d.DEVICE_ID}>{d.DEVICE_CODE}</option>)}
               </select>
            </div>
            <div className="space-y-1"><label className={LabelClass}>Image URL</label><input className={InputClass} value={form.IMAGE_URL} onChange={e => setForm({...form, IMAGE_URL: e.target.value})} placeholder="https://..." /></div>
        </div>
        <div className="border-t border-white/10 p-6 bg-[#18181b] flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-white hover:bg-white/5 transition">Cancel</button>
            <button onClick={handleSubmit} disabled={loading} className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow-lg shadow-indigo-500/20">{loading ? "Saving..." : "Save Vehicle"}</button>
        </div>
      </div>
    </div>
  );
}

/* ================= MAIN PAGE COMPONENT ================= */
export function CarsPage() {
  const { user, token } = useAuth();
  const isSup = user?.role === "supervisor";

  const [cars, setCars] = useState<CarRow[]>([]);
  const [activeCarIds, setActiveCarIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  
  const [selectedCar, setSelectedCar] = useState<CarRow | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);

  // 1. Fetch Static Car Data
  const fetchCars = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const qs = isSup ? "" : `?branchId=${user.branchId}`;
      const res = await fetch(`${API_URL}/api/v1/cars${qs}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCars(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Fetch error", e); } 
    finally { setLoading(false); }
  };

  // 2. Fetch Live Active IDs from the Stream
  const fetchActiveStatus = async () => {
     try {
        const res = await fetch(`${API_URL}/api/v1/iot-telemetry/live`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (Array.isArray(data)) {
            // Extract IDs of cars that are in the live buffer
            const ids = new Set(data.map((d: any) => d.CAR_ID));
            setActiveCarIds(ids);
        }
     } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    fetchCars(); 
    fetchActiveStatus();
    
    // Poll active status every 3 seconds to update UI in real-time
    const interval = setInterval(fetchActiveStatus, 3000);
    return () => clearInterval(interval);
  }, [user?.role, user?.branchId]);

  // 3. Merge Static Data with Live Status
  const mergedCars = useMemo(() => {
    return cars.map(c => {
        // If this car is in the live stream, FORCE status to DRIVING
        if (activeCarIds.has(c.CAR_ID)) {
            return { ...c, STATUS: "DRIVING" };
        }
        return c;
    });
  }, [cars, activeCarIds]);

  const filtered = useMemo(() => {
    return mergedCars.filter(c => {
        const matchesQ = [c.MAKE, c.MODEL, c.VIN, c.LICENSE_PLATE].join(" ").toLowerCase().includes(q.toLowerCase());
        const matchesStatus = status === "ALL" || c.STATUS === status;
        const matchesCat = category === "ALL" || String(c.CATEGORY_ID) === category;
        return matchesQ && matchesStatus && matchesCat;
    });
  }, [mergedCars, q, status, category]);

  /* --- RENDER HELPERS --- */
  const HeaderControls = (
    <div className="flex flex-wrap items-center gap-3">
       <input 
         className="h-9 w-48 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:w-64 transition-all"
         placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} 
       />
       <select className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white bg-[#18181b]" value={category} onChange={e => setCategory(e.target.value)}>
         <option value="ALL">All Categories</option>
         {[1,2,3,4,5].map(id => <option key={id} value={String(id)}>{categoryLabel(id)}</option>)}
       </select>
       
       <div className="flex h-9 items-center rounded-lg border border-white/10 bg-white/5 p-1">
         <button onClick={() => setViewMode("cards")} className={`px-2 rounded ${viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-neutral-400'}`}><LayoutGrid size={16}/></button>
         <button onClick={() => setViewMode("table")} className={`px-2 rounded ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-neutral-400'}`}><List size={16}/></button>
       </div>
       
       <button onClick={fetchCars} className="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 hover:text-white"><RefreshCw size={16}/></button>
       
       {isSup && (
         <button onClick={() => setCreateOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500">
            <Plus size={16} /> Add Car
         </button>
       )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card title={isSup ? "Global Fleet" : "Branch Fleet"} subtitle={`${filtered.length} vehicles`} right={HeaderControls} className="min-h-[600px]">
        
        {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1,2,3].map(i => <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
        ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-neutral-500"><Search className="mx-auto mb-3" /> No vehicles found.</div>
        ) : viewMode === "table" ? (
          <DataTable 
             rows={filtered}
             cols={[
                { key: "MAKE", header: "Vehicle", render: r => <span className="text-white font-medium">{r.MAKE} {r.MODEL}</span> },
                { key: "LICENSE_PLATE", header: "Plate", render: r => <code className="bg-white/10 px-1 rounded">{r.LICENSE_PLATE}</code> },
                { key: "STATUS", header: "Status", render: r => <Badge tone={badgeTone(r.STATUS)}>{r.STATUS}</Badge> },
                { key: "ODOMETER_KM", header: "Mileage", render: r => fmtKm(r.ODOMETER_KM) },
                { key: "actions", header: "", render: r => <button onClick={() => setSelectedCar(r)} className="text-indigo-400 hover:underline">Details</button> }
             ]}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
             {filtered.map(c => (
                <div key={c.CAR_ID} className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#18181b] hover:border-indigo-500/30 transition-all">
                   <div className="h-48 bg-[#09090b] relative">
                      {c.IMAGE_URL ? <img src={c.IMAGE_URL} className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition" /> : <div className="grid place-items-center h-full text-neutral-600"><CarIcon size={48}/></div>}
                      
                      {/* Active Status Overlay */}
                      <div className="absolute top-3 left-3">
                         <Badge tone={badgeTone(c.STATUS)}>
                            {c.STATUS === 'DRIVING' ? (
                                <span className="flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                    </span>
                                    DRIVING
                                </span>
                            ) : c.STATUS}
                         </Badge>
                      </div>
                   </div>
                   <div className="p-5">
                      <h4 className="text-lg font-bold text-white">{c.MAKE} {c.MODEL}</h4>
                      <div className="mt-4 flex gap-2 text-xs">
                          <div className="bg-white/5 p-2 rounded flex-1 flex items-center gap-2 text-neutral-400"><Gauge size={12}/> {fmtKm(c.ODOMETER_KM)}</div>
                          <div className="bg-white/5 p-2 rounded flex-1 flex items-center gap-2 text-neutral-400"><MapPin size={12}/> {c.BRANCH_CITY || "N/A"}</div>
                      </div>
                      <button onClick={() => setSelectedCar(c)} className="mt-4 w-full rounded-xl bg-white/5 py-2 text-sm font-medium text-neutral-300 hover:bg-white/10">View Details</button>
                   </div>
                </div>
             ))}
          </div>
        )}
      </Card>

      <CarDetailsDrawer car={selectedCar} onClose={() => setSelectedCar(null)} />
      <CreateCarModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onSuccess={fetchCars} />
    </div>
  );
}
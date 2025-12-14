import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { GlassCard } from "../components/GlassCard";
import { User, Mail, Shield, Hash, MapPin, BadgeCheck } from "lucide-react";

function initials(first?: string, last?: string) {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "U";
}

function roleLabel(role?: string | null) {
  const r = String(role || "").toLowerCase();
  if (r === "supervisor") return "SUPERVISOR";
  if (r === "manager") return "MANAGER";
  return (role || "ADMIN").toString().toUpperCase();
}

export function ProfilePage() {
  const { user } = useAuth();

  const meta = useMemo(() => {
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
    const role = roleLabel(user?.role);
    const scope = user?.branchId == null ? "All branches" : `Branch #${user.branchId}`;
    return { fullName, role, scope };
  }, [user]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HERO CARD */}
      <GlassCard className="!p-0 overflow-hidden">
        <div className="relative p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-violet-600/5 to-transparent" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-extrabold text-white shadow-lg shadow-indigo-500/20">
                {initials(user?.firstName, user?.lastName)}
              </div>

              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-white truncate">{meta.fullName}</h1>
                <p className="mt-1 text-sm text-neutral-400 truncate">{user?.email || "—"}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-indigo-300">
                    <BadgeCheck className="h-4 w-4" />
                    {meta.role}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-neutral-300">
                    <MapPin className="h-4 w-4 text-neutral-400" />
                    {meta.scope}
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden md:block text-right">
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                DriveOps • Profile
              </div>
              <div className="mt-2 text-sm text-neutral-400">
                Your account & access details
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* DETAILS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <GlassCard title="Account Details" subtitle="Identity & access scope">
            <div className="space-y-3">
              <Row icon={User} label="Full name" value={meta.fullName} />
              <Row icon={Mail} label="Email" value={user?.email || "—"} />
              <Row icon={Shield} label="Role" value={meta.role} />
              <Row
                icon={MapPin}
                label="Branch scope"
                value={user?.branchId == null ? "All branches" : `Branch #${user.branchId}`}
              />
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-5">
          <GlassCard title="Identifiers" subtitle="Internal references">
            <div className="space-y-3">
              <Row icon={Hash} label="Manager ID" value={user?.managerId != null ? String(user.managerId) : "—"} />
              <Row icon={Hash} label="Manager Code" value={user?.managerCode ? String(user.managerCode) : "—"} />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-bold text-neutral-300">Note</div>
              <div className="mt-1 text-sm text-neutral-400">
                Le profile lit les infos du token (AuthContext). Si tu veux “edit profile”,
                il faudra une route API (PUT /me) + update du token.
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-[#18181b] p-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-neutral-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-neutral-500">{label}</div>
          <div className="text-sm font-bold text-white truncate">{value}</div>
        </div>
      </div>
    </div>
  );
}

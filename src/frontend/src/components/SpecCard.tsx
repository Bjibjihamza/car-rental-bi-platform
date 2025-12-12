import React from "react";

type ThemeColor = "orange" | "blue" | "yellow" | "purple" | "green";

const themes: Record<ThemeColor, { bg: string; iconBg: string; text: string }> = {
  orange: { bg: "bg-orange-50", iconBg: "bg-orange-100", text: "text-orange-600" },
  blue: { bg: "bg-blue-50", iconBg: "bg-blue-100", text: "text-blue-600" },
  yellow: { bg: "bg-yellow-50", iconBg: "bg-yellow-100", text: "text-yellow-600" },
  purple: { bg: "bg-purple-50", iconBg: "bg-purple-100", text: "text-purple-600" },
  green: { bg: "bg-emerald-50", iconBg: "bg-emerald-100", text: "text-emerald-600" },
};

export function SpecCard({
  label,
  value,
  subValue,
  icon,
  theme = "blue",
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  theme?: ThemeColor;
}) {
  const t = themes[theme];
  return (
    <div className={`flex items-center gap-4 rounded-[24px] p-4 ${t.bg} transition-transform hover:scale-[1.02]`}>
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${t.iconBg} ${t.text}`}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className="text-xl font-bold text-slate-900">{value}</div>
        {subValue && <div className="text-xs text-slate-400">{subValue}</div>}
      </div>
    </div>
  );
}
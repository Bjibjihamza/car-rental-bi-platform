import React from "react";
import { Card } from "./Card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  trend,
  trendDirection = "up", // 'up' or 'down'
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: string;
  trendDirection?: "up" | "down";
  icon?: React.ReactNode;
}) {
  return (
    <Card className="hover:border-indigo-100 transition-colors duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          
          {/* Bottom Meta Data (Hint or Trend) */}
          <div className="flex items-center gap-2 pt-1">
            {trend && (
              <span
                className={`flex items-center text-xs font-bold ${
                  trendDirection === "up" ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {trendDirection === "up" ? (
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                ) : (
                  <ArrowDownRight className="mr-1 h-3 w-3" />
                )}
                {trend}
              </span>
            )}
            {hint && (
              <span className="text-xs font-medium text-slate-400">
                {hint}
              </span>
            )}
          </div>
        </div>

        {/* Icon Container */}
        {icon && (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
import React from "react";

const TONES = {
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
  gray: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  purple: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

export function Badge({ 
  tone, 
  children 
}: { 
  tone: keyof typeof TONES; 
  children: React.ReactNode 
}) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
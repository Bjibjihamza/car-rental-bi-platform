import React from "react";

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
  noPadding = false,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-[24px] border border-white/5 bg-[#121212]/60 backdrop-blur-xl shadow-2xl ${className}`}>
      {/* Glossy Top Edge Effect */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {(title || right) && (
        <div className="flex flex-col gap-4 border-b border-white/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>}
            {subtitle && <div className="mt-1 text-sm text-neutral-400">{subtitle}</div>}
          </div>
          <div>{right}</div>
        </div>
      )}
      
      <div className={`flex-1 ${noPadding ? "" : "p-6"}`}>
        {children}
      </div>
    </div>
  );
}
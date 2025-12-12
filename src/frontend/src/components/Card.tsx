import React from "react";

export function Card({
  title,
  right,
  children,
  className = "",
  noPadding = false,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div
      // The key changes are here: rounded-[30px], border-none, shadow-sm
      className={`flex flex-col rounded-[30px] border-none bg-white shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between px-6 pt-6 mb-2">
          <div className="text-lg font-bold text-slate-800">{title}</div>
          <div>{right}</div>
        </div>
      )}
      <div className={noPadding ? "" : "p-6"}>{children}</div>
    </div>
  );
}
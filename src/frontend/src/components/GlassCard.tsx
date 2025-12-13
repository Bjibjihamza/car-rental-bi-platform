// src/frontend/src/components/GlassCard.tsx
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
};

export function GlassCard({ children, className = "", title }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border border-white/5 bg-[#121212]/60 backdrop-blur-xl p-6 shadow-2xl ${className}`}
    >
      {/* Subtle top gradient for "shine" effect */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {title && (
        <h3 className="mb-4 text-lg font-bold tracking-tight text-white">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
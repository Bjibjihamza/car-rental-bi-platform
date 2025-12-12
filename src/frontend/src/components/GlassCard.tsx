import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion } from "framer-motion";

export function GlassCard({ children, className, title, right }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={twMerge(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/60 backdrop-blur-xl shadow-2xl",
        className
      )}
    >
      {/* Subtle Gradient Glow in background */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-white/5 p-6">
          {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
          {right && <div>{right}</div>}
        </div>
      )}
      <div className="p-6 relative z-10">{children}</div>
    </motion.div>
  );
}
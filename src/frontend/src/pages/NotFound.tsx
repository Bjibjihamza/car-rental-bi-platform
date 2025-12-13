import { Link } from "react-router-dom";
import { ArrowLeft, FileQuestion } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      
      {/* Icon Container */}
      <div className="mb-6 grid h-24 w-24 place-items-center rounded-3xl bg-white/5 shadow-2xl shadow-indigo-500/10 ring-1 ring-white/10">
        <FileQuestion className="h-10 w-10 text-indigo-400" />
      </div>

      <h1 className="mb-2 text-5xl font-black tracking-tight text-white">404</h1>
      <h2 className="mb-6 text-lg font-medium text-neutral-400">
        Oops! We couldn't find that page.
      </h2>

      <p className="mb-8 max-w-md text-sm text-neutral-500 leading-relaxed">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>

      <Link
        to="/dashboard"
        className="group flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 hover:scale-105"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Dashboard
      </Link>
    </div>
  );
}
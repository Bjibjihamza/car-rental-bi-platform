import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";

type Col<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends Record<string, any>>({
  rows,
  cols,
  initialPageSize = 8,
  emptyText = "No data found",
}: {
  rows: T[];
  cols: Col<T>[];
  initialPageSize?: number;
  emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(query))
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-white transition" />
          <input
            className="h-9 w-full sm:w-64 rounded-xl border border-white/5 bg-white/5 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-indigo-500/50 focus:bg-white/10 outline-none transition"
            placeholder="Filter table..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <span>Rows:</span>
          <select
            className="rounded-lg border border-white/5 bg-white/5 px-2 py-1 text-white focus:border-indigo-500/50 outline-none"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[5, 8, 10, 20, 50].map((n) => (
              <option key={n} value={n} className="bg-[#18181b]">{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-neutral-400">
                {cols.map((c) => (
                  <th key={c.header} className={`px-4 py-3 font-medium whitespace-nowrap ${c.className || ''}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-8 text-center text-neutral-500">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                slice.map((r, idx) => (
                  <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                    {cols.map((c) => (
                      <td key={c.header} className={`px-4 py-3 text-neutral-300 ${c.className || ''}`}>
                        {c.render ? c.render(r) : String(r[c.key as keyof T] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <div>
          Showing {filtered.length > 0 ? (safePage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => setPage(1)} disabled={safePage === 1}>
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button className="p-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => setPage(p => p - 1)} disabled={safePage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-white font-medium">Page {safePage}</span>
          <button className="p-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => setPage(p => p + 1)} disabled={safePage === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button className="p-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
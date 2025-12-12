import { useMemo, useState } from "react";

type Col<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
};

export function DataTable<T extends Record<string, any>>({
  rows,
  cols,
  initialPageSize = 8,
  emptyText = "No data",
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
    <div className="table-wrap">
      <div className="table-toolbar">
        <input
          className="input"
          placeholder="Filter..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <div className="row gap-8">
          <span className="muted">Rows</span>
          <select
            className="select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[6, 8, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.header}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="muted" style={{ padding: 16 }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              slice.map((r, idx) => (
                <tr key={idx}>
                  {cols.map((c) => (
                    <td key={c.header}>
                      {c.render ? c.render(r) : String(r[c.key as keyof T] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="muted">
          {filtered.length} rows • page {safePage}/{totalPages}
        </div>
        <div className="row gap-8">
          <button className="btn btn-ghost" onClick={() => setPage(1)} disabled={safePage === 1}>
            {"<<"}
          </button>
          <button className="btn btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
            {"<"}
          </button>
          <button className="btn btn-ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
            {">"}
          </button>
          <button className="btn btn-ghost" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
            {">>"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="center">
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="card-body">
          <div className="strong" style={{ fontSize: 18 }}>404</div>
          <div className="muted">Page not found.</div>
          <div style={{ marginTop: 12 }}>
            <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

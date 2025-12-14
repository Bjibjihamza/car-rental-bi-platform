// src/frontend/src/auth/ProtectedRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token, user } = useAuth();
  const location = useLocation();

  const t = token || localStorage.getItem("token");
  const uRaw = localStorage.getItem("user");
  const u = user || (uRaw ? JSON.parse(uRaw) : null);

  // must have BOTH token and user
  if (!t || !u) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

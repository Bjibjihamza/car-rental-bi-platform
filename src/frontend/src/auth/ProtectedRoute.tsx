import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  const location = useLocation();

  const t = token || localStorage.getItem("token"); // ✅ fallback

  if (!t) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

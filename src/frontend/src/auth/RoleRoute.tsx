import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

type Role = "manager" | "supervisor";

export function RoleRoute({
  allow,
  children,
}: {
  allow: Role[];
  children: JSX.Element;
}) {
  const { user, token } = useAuth();
  const t = token || localStorage.getItem("token");

  if (!t || !user) return <Navigate to="/login" replace />;

  if (!allow.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

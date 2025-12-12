import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { Layout } from "../components/Layout";

import { LoginPage } from "../pages/Login";
import { DashboardPage } from "../pages/Dashboard";
import { CarsPage } from "../pages/Cars";
import { DevicesPage } from "../pages/Devices";
import { RentalsPage } from "../pages/Rentals";
import { BranchesPage } from "../pages/Branches";
import { AlertsPage } from "../pages/Alerts";
import { TelemetryPage } from "../pages/Telemetry";
import { NotFoundPage } from "../pages/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="cars" element={<CarsPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="rentals" element={<RentalsPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="telemetry" element={<TelemetryPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

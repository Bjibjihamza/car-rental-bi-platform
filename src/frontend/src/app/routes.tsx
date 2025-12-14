import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { ProtectedLayout } from "../components/ProtectedLayout";

import { LoginPage } from "../pages/Login";
import { DashboardPage } from "../pages/Dashboard";
import { CarsPage } from "../pages/Cars";
import { DevicesPage } from "../pages/Devices";
import { BranchesPage } from "../pages/Branches";
import { RentalsPage } from "../pages/Rentals";
import { RentalReportPage } from "../pages/RentalReport";
import { AlertsPage } from "../pages/Alerts";
import { TelemetryPage } from "../pages/Telemetry";
import { ManagersPage } from "../pages/Managers";
import { LiveMonitor } from "../pages/LiveMonitor";
import { NotFoundPage } from "../pages/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        element={
          <ProtectedRoute>
            <ProtectedLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/live" element={<LiveMonitor />} />
        <Route path="/cars" element={<CarsPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/rentals" element={<RentalsPage />} />

        {/* ✅ REDIRECT TARGET */}
        <Route path="/rentals/:id/report" element={<RentalReportPage />} />

        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/telemetry" element={<TelemetryPage />} />
        <Route path="/managers" element={<ManagersPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

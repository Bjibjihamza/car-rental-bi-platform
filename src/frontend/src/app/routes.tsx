// src/frontend/src/app/routes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { ProtectedLayout } from "../components/ProtectedLayout";

import { LoginPage } from "../pages/Login";
import { DashboardPage } from "../pages/Dashboard";
import { CarsPage } from "../pages/Cars";
import { DevicesPage } from "../pages/Devices";
import { BranchesPage } from "../pages/Branches";
import { RentalsPage } from "../pages/Rentals";
import { RentalsCreatePage } from "../pages/RentalsCreate"; // ✅ NEW
import { RentalReportPage } from "../pages/RentalReport";
import { AlertsPage } from "../pages/Alerts";
import { TelemetryPage } from "../pages/Telemetry";
import { ManagersPage } from "../pages/Managers";
import { LiveMonitor } from "../pages/LiveMonitor";
import { NotFoundPage } from "../pages/NotFound";
import { ProfilePage } from "../pages/Profile";
import { CustomersPage } from "../pages/Customers";


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

        {/* ✅ Rentals */}
        <Route path="/rentals" element={<RentalsPage />} />
        <Route path="/rentals/new" element={<RentalsCreatePage />} /> {/* ✅ NEW */}
        <Route path="/rentals/:id/report" element={<RentalReportPage />} />

<Route path="/customers" element={<CustomersPage />} />

        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/telemetry" element={<TelemetryPage />} />
        <Route path="/managers" element={<ManagersPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

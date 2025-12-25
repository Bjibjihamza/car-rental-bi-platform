// src/frontend/src/api/analytics.ts
import { apiGet } from "./http";

export type DashboardOverview = {
  today: {
    rentals: number;
    revenueMAD: number;
    alertsOpen: number;
    activeRentalsNow: number;
  };
  fleet: {
    total: number;
    available: number;
    rented: number;
    maintenance: number;
  };
  source?: "GOLD" | "SILVER";
};

export type DailyPoint = {
  DATE_KEY: number;
  FULL_DATE: string;
  VALUE: number;
};

export async function fetchDashboardOverview() {
  return apiGet<DashboardOverview>("http://localhost:8000/api/v1/analytics/dashboard/overview");
}

export async function fetchRentalsDaily(days = 30) {
  return apiGet<DailyPoint[]>(
    `http://localhost:8000/api/v1/analytics/kpi/rentals-daily?days=${days}`
  );
}

export async function fetchAlertsDaily(days = 30) {
  return apiGet<DailyPoint[]>(
    `http://localhost:8000/api/v1/analytics/kpi/alerts-daily?days=${days}`
  );
}

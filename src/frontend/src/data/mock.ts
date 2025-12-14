export type Branch = { branchId: number; name: string; city: string; phone: string };
export type Car = {
  carId: number;
  vin: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  status: "AVAILABLE" | "RESERVED" | "RENTED" | "MAINTENANCE" | "RETIRED";
  category: string;
  branchId: number;
  deviceId?: number | null;
  odometerKm: number;
};
export type Device = {
  deviceId: number;
  code: string;
  imei: string;
  firmware: string;
  status: "ACTIVE" | "INACTIVE" | "RETIRED";
  lastSeenAt: string;
};
export type Rental = {
  rentalId: number;
  carId: number;
  customer: string;
  startAt: string;
  dueAt: string;
  returnAt?: string | null;
  status: "ACTIVE" | "IN_PROGRESS" | "CLOSED" | "CANCELLED";
  totalAmount: number;
  currency: "MAD";
};
export type Alert = {
  alertId: number;
  branchId: number;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};
export type Telemetry = {
  telemetryId: number;
  deviceId: number;
  carId: number;
  rentalId?: number | null;
  eventTs: string;
  speedKmh: number;
  fuelPct: number;
  engineTempC: number;
  eventType: "ENGINE_START" | "DRIVING" | "HARSH_BRAKE" | "RAPID_ACCEL" | "IDLE" | "ENGINE_STOP";
};

export const branches: Branch[] = [
  { branchId: 1, name: "Casablanca HQ", city: "Casablanca", phone: "+212 5 22 00 00 00" },
  { branchId: 2, name: "Rabat Center", city: "Rabat", phone: "+212 5 37 00 00 00" },
  { branchId: 3, name: "Marrakech Airport", city: "Marrakech", phone: "+212 5 24 00 00 00" },
];

export const devices: Device[] = [
  { deviceId: 10, code: "IOT-DO-001", imei: "356789012345678", firmware: "1.7.2", status: "ACTIVE", lastSeenAt: "2025-12-12T10:12:00Z" },
  { deviceId: 11, code: "IOT-DO-002", imei: "356789012345679", firmware: "1.7.1", status: "ACTIVE", lastSeenAt: "2025-12-12T10:10:00Z" },
  { deviceId: 12, code: "IOT-DO-003", imei: "356789012345680", firmware: "1.6.9", status: "INACTIVE", lastSeenAt: "2025-12-10T08:02:00Z" },
  { deviceId: 13, code: "IOT-DO-004", imei: "356789012345681", firmware: "1.7.2", status: "RETIRED", lastSeenAt: "2025-11-02T14:21:00Z" },
];

export const cars: Car[] = [
  { carId: 100, vin: "VIN-DO-100", plate: "AA-1234", make: "Hyundai", model: "Tucson", year: 2023, color: "Blue", status: "AVAILABLE", category: "SUV", branchId: 1, deviceId: 10, odometerKm: 38450 },
  { carId: 101, vin: "VIN-DO-101", plate: "BB-7721", make: "Dacia", model: "Logan", year: 2022, color: "White", status: "RENTED", category: "Sedan", branchId: 2, deviceId: 11, odometerKm: 51220 },
  { carId: 102, vin: "VIN-DO-102", plate: "CC-5510", make: "Kia", model: "Picanto", year: 2021, color: "Red", status: "MAINTENANCE", category: "City", branchId: 1, deviceId: 12, odometerKm: 68900 },
  { carId: 103, vin: "VIN-DO-103", plate: "DD-9001", make: "Toyota", model: "Corolla", year: 2024, color: "Gray", status: "AVAILABLE", category: "Sedan", branchId: 3, deviceId: null, odometerKm: 11000 },
];

export const rentals: Rental[] = [
  { rentalId: 5001, carId: 101, customer: "Sara El Amrani", startAt: "2025-12-11T09:00:00Z", dueAt: "2025-12-13T09:00:00Z", status: "ACTIVE", totalAmount: 950, currency: "MAD" },
  { rentalId: 5002, carId: 100, customer: "Youssef Ait Lahcen", startAt: "2025-12-09T14:00:00Z", dueAt: "2025-12-10T14:00:00Z", returnAt: "2025-12-10T16:20:00Z", status: "CLOSED", totalAmount: 620, currency: "MAD" },
  { rentalId: 5003, carId: 102, customer: "Imane Berrada", startAt: "2025-12-07T12:00:00Z", dueAt: "2025-12-08T12:00:00Z", status: "CANCELLED", totalAmount: 0, currency: "MAD" },
];

export const alerts: Alert[] = [
  { alertId: 9001, branchId: 1, status: "OPEN", createdAt: "2025-12-12T09:44:00Z", title: "Harsh brake spike detected", severity: "MEDIUM" },
  { alertId: 9002, branchId: 2, status: "OPEN", createdAt: "2025-12-12T09:20:00Z", title: "Device offline > 24h", severity: "HIGH" },
  { alertId: 9003, branchId: 3, status: "RESOLVED", createdAt: "2025-12-10T18:05:00Z", title: "Engine temp anomaly", severity: "LOW" },
];

export const telemetry: Telemetry[] = [
  { telemetryId: 1, deviceId: 10, carId: 100, rentalId: 5002, eventTs: "2025-12-10T15:52:00Z", speedKmh: 78, fuelPct: 62, engineTempC: 92, eventType: "DRIVING" },
  { telemetryId: 2, deviceId: 11, carId: 101, rentalId: 5001, eventTs: "2025-12-12T10:06:00Z", speedKmh: 34, fuelPct: 45, engineTempC: 96, eventType: "RAPID_ACCEL" },
  { telemetryId: 3, deviceId: 11, carId: 101, rentalId: 5001, eventTs: "2025-12-12T10:08:00Z", speedKmh: 12, fuelPct: 44, engineTempC: 98, eventType: "HARSH_BRAKE" },
  { telemetryId: 4, deviceId: 10, carId: 100, rentalId: null, eventTs: "2025-12-12T09:50:00Z", speedKmh: 0, fuelPct: 63, engineTempC: 72, eventType: "IDLE" },
];
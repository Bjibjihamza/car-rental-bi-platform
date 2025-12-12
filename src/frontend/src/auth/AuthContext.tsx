import React, { createContext, useContext, useMemo, useState } from "react";

type Manager = {
  managerId: number;
  managerCode: string;
  firstName: string;
  lastName: string;
  email: string;
  branchId: number;
  branchName: string;
};

type AuthState = {
  isAuthed: boolean;
  manager: Manager | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const LS_KEY = "driveops_auth_v1";

function readLS(): { manager: Manager } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLS(payload: { manager: Manager } | null) {
  if (!payload) localStorage.removeItem(LS_KEY);
  else localStorage.setItem(LS_KEY, JSON.stringify(payload));
}

// Mock “managers table”
const MOCK_MANAGER: Manager = {
  managerId: 1,
  managerCode: "MGR-001",
  firstName: "Hamza",
  lastName: "Bjibji",
  email: "manager@driveops.io",
  branchId: 1,
  branchName: "Casablanca HQ",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const boot = readLS();
  const [manager, setManager] = useState<Manager | null>(boot?.manager ?? null);

  const login = async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 650)); // simulate latency
    // Demo credentials:
    // email: manager@driveops.io
    // password: DriveOps#123
    if (email === MOCK_MANAGER.email && password === "DriveOps#123") {
      setManager(MOCK_MANAGER);
      writeLS({ manager: MOCK_MANAGER });
      return;
    }
    throw new Error("Invalid credentials");
  };

  const logout = () => {
    setManager(null);
    writeLS(null);
  };

  const value = useMemo<AuthState>(
    () => ({
      isAuthed: !!manager,
      manager,
      login,
      logout,
    }),
    [manager]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

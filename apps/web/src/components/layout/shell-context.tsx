"use client";

import * as React from "react";

export interface Whoami {
  tenantId: string;
  tenantName?: string;
  tenantSlug?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  employeeId: string | null;
  membershipStatus: string;
  assurance: string;
  roles: Array<{ key: string; scopeType: string }>;
  permissions: Array<{ key: string; scopeType: string }>;
  teamMemberships: string[];
  reporting: { managerId: string | null; reports: string[] };
  accessGroupIds: string[];
  policyVersion: number;
  builtAt: string;
}

interface ShellState {
  whoami: Whoami | null;
  loading: boolean;
  error: string | null;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  can: (permission: string) => boolean;
  retry: () => void;
}

const ShellContext = React.createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [whoami, setWhoami] = React.useState<Whoami | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const loading = !whoami && !error;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/authz/whoami");
        if (!res.ok) {
          window.location.href = "/auth/login";
          return;
        }
        const data: Whoami = await res.json();
        if (!cancelled) {
          setWhoami(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load session context");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const can = React.useCallback(
    (permission: string) =>
      whoami?.permissions.some((p) => p.key === permission) ?? false,
    [whoami],
  );

  const retry = React.useCallback(() => setAttempt((a) => a + 1), []);

  const value = React.useMemo(
    () => ({ whoami, loading, error, mobileOpen, setMobileOpen, can, retry }),
    [whoami, loading, error, mobileOpen, setMobileOpen, can, retry],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}

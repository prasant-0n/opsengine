/**
 * Tenant Lifecycle, Data Export & Retention Types
 * PRD §14.3 (Security and Privacy), Module 0A & §18.7 (Runbooks)
 */

export type TenantLifecycleState =
  | "ACTIVE"
  | "QUARANTINED"
  | "OFFBOARDED"
  | "PURGED";

export interface TenantLifecycleRecord {
  tenantId: string;
  state: TenantLifecycleState;
  updatedAt: string;
  updatedBy: string;
  reason?: string;
  quarantinedAt?: string;
  offboardedAt?: string;
  purgedAt?: string;
  history: Array<{
    state: TenantLifecycleState;
    timestamp: string;
    operatorId: string;
    reason?: string;
  }>;
}

export interface TenantExportManifest {
  exportId: string;
  tenantId: string;
  tenantName: string;
  generatedAt: string;
  expiresAt: string;
  formatVersion: "1.0.0";
  checksumSha256: string;
  entityCounts: {
    users: number;
    employees: number;
    teams: number;
    tickets: number;
    projects: number;
    invoices: number;
    approvals: number;
    auditLogs: number;
  };
}

export interface TenantExportBundle {
  manifest: TenantExportManifest;
  data: {
    organization: Record<string, unknown>;
    users: Array<Record<string, unknown>>;
    employees: Array<Record<string, unknown>>;
    teams: Array<Record<string, unknown>>;
    workManagement: {
      tickets: Array<Record<string, unknown>>;
      projects: Array<Record<string, unknown>>;
    };
    finance: {
      invoices: Array<Record<string, unknown>>;
    };
    workflow: {
      approvals: Array<Record<string, unknown>>;
    };
    auditTrail: Array<Record<string, unknown>>;
  };
}

export interface PurgeReceipt {
  receiptId: string;
  tenantId: string;
  purgedAt: string;
  operatorId: string;
  reason: string;
  recordsShreddedCount: number;
  cryptographicSignature: string;
}

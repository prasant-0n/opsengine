export const GENESIS_PREVIOUS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export interface AuditRecordInput {
  actorUserId?: string | null;
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  decision?: "allow" | "deny" | null;
  reasonCode?: string | null;
  policyVersion?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string; // Optional custom timestamp or defaults to now
}

export interface TamperEvidentAuditRecord {
  id: string;
  tenantId: string;
  sequenceNumber: number;
  previousHash: string;
  recordHash: string;
  chainSeal?: string | null;
  actorUserId?: string | null;
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  decision?: "allow" | "deny" | null;
  reasonCode?: string | null;
  policyVersion?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type TamperViolationType =
  | "PAYLOAD_TAMPERED"
  | "SEQUENCE_GAP"
  | "HASH_CHAIN_BROKEN"
  | "GENESIS_INVALID"
  | "SEAL_MISMATCH";

export interface TamperViolation {
  sequenceNumber: number;
  recordId: string;
  violationType: TamperViolationType;
  expected: string;
  actual: string;
  message: string;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  tenantId: string;
  totalRecords: number;
  chainHeadHash: string | null;
  genesisHash: string;
  verifiedAt: string;
  durationMs: number;
  violations: TamperViolation[];
}

export interface CryptographicAuditProof {
  tenantId: string;
  startSequence: number;
  endSequence: number;
  initialPreviousHash: string;
  terminalHash: string;
  recordCount: number;
  records: Array<{
    id: string;
    sequenceNumber: number;
    previousHash: string;
    recordHash: string;
    canonicalPayload: string;
    chainSeal?: string | null;
  }>;
  generatedAt: string;
}

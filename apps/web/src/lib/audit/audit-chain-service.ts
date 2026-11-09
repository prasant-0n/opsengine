import { randomUUID } from "node:crypto";
import { canonicalJson, sha256, hmacSha256 } from "./canonical";
import {
  AuditRecordInput,
  TamperEvidentAuditRecord,
  AuditChainVerificationResult,
  CryptographicAuditProof,
  TamperViolation,
  GENESIS_PREVIOUS_HASH,
} from "./types";

export function createCanonicalPayload(record: {
  tenantId: string;
  sequenceNumber: number;
  previousHash: string;
  actorUserId?: string | null;
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  decision?: "allow" | "deny" | null;
  reasonCode?: string | null;
  policyVersion?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}): string {
  return canonicalJson({
    actorUserId: record.actorUserId ?? null,
    createdAt: record.createdAt,
    decision: record.decision ?? null,
    eventType: record.eventType,
    metadata: record.metadata ?? null,
    previousHash: record.previousHash,
    reasonCode: record.reasonCode ?? null,
    resourceId: record.resourceId ?? null,
    resourceType: record.resourceType ?? null,
    sequenceNumber: record.sequenceNumber,
    tenantId: record.tenantId,
  });
}

export class AuditChainService {
  // Tenant ID -> Array of tamper-evident audit records in sequence order
  private chains = new Map<string, TamperEvidentAuditRecord[]>();
  // Tenant ID -> Serial queue promise to prevent race conditions during concurrent appends
  private writeQueues = new Map<string, Promise<unknown>>();

  /**
   * Resets all stored audit records (primarily used for test isolation).
   */
  public reset(tenantId?: string): void {
    if (tenantId) {
      this.chains.delete(tenantId);
      this.writeQueues.delete(tenantId);
    } else {
      this.chains.clear();
      this.writeQueues.clear();
    }
  }

  /**
   * Appends an audit record to the tenant's cryptographic chain atomically.
   */
  public async appendRecord(
    tenantId: string,
    input: AuditRecordInput,
    signingKey?: string
  ): Promise<TamperEvidentAuditRecord> {
    if (!tenantId) {
      throw new Error("tenantId is required to append an audit record");
    }
    if (!input.eventType) {
      throw new Error("eventType is required to append an audit record");
    }

    // Acquire or chain onto tenant serial write queue
    const previousQueue = this.writeQueues.get(tenantId) || Promise.resolve();

    let queueResolver: () => void = () => {};
    const nextQueue = new Promise<void>((resolve) => {
      queueResolver = resolve;
    });
    this.writeQueues.set(tenantId, nextQueue);

    await previousQueue;

    try {
      const records = this.chains.get(tenantId) || [];
      const previousRecord = records.length > 0 ? records[records.length - 1] : null;

      const sequenceNumber = previousRecord ? previousRecord.sequenceNumber + 1 : 1;
      const previousHash = previousRecord ? previousRecord.recordHash : GENESIS_PREVIOUS_HASH;
      const createdAt = input.createdAt || new Date().toISOString();
      const id = randomUUID();

      const canonicalPayload = createCanonicalPayload({
        tenantId,
        sequenceNumber,
        previousHash,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        decision: input.decision,
        reasonCode: input.reasonCode,
        policyVersion: input.policyVersion,
        metadata: input.metadata,
        createdAt,
      });

      const recordHash = sha256(canonicalPayload);
      const chainSeal = signingKey ? hmacSha256(recordHash, signingKey) : null;

      const record: TamperEvidentAuditRecord = {
        id,
        tenantId,
        sequenceNumber,
        previousHash,
        recordHash,
        chainSeal,
        actorUserId: input.actorUserId ?? null,
        eventType: input.eventType,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        decision: input.decision ?? null,
        reasonCode: input.reasonCode ?? null,
        policyVersion: input.policyVersion ?? null,
        metadata: input.metadata ?? null,
        createdAt,
      };

      records.push(record);
      this.chains.set(tenantId, records);

      return record;
    } finally {
      queueResolver();
    }
  }

  /**
   * Returns audit records for a tenant with optional pagination.
   */
  public async getRecords(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ total: number; records: TamperEvidentAuditRecord[] }> {
    const records = this.chains.get(tenantId) || [];
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    return {
      total: records.length,
      records: records.slice(offset, offset + limit),
    };
  }

  /**
   * Cryptographically verifies the entire audit chain for a tenant.
   * Traverses all records from sequence 1 to the chain head:
   * - Checks contiguous sequence numbers (seq_i = seq_{i-1} + 1).
   * - Checks hash chaining continuity (prevHash_i = recordHash_{i-1}).
   * - Recomputes canonical payload SHA-256 and checks equality.
   * - Verifies HMAC chain seal if signing key is provided.
   */
  public async verifyChain(
    tenantId: string,
    signingKey?: string
  ): Promise<AuditChainVerificationResult> {
    const startTime = performance.now();
    const records = this.chains.get(tenantId) || [];
    const violations: TamperViolation[] = [];

    let lastRecordHash = GENESIS_PREVIOUS_HASH;
    let expectedSequence = 1;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // 1. Sequence Contiguity Check
      if (record.sequenceNumber !== expectedSequence) {
        violations.push({
          sequenceNumber: record.sequenceNumber,
          recordId: record.id,
          violationType: "SEQUENCE_GAP",
          expected: `Sequence ${expectedSequence}`,
          actual: `Sequence ${record.sequenceNumber}`,
          message: `Sequence gap detected: expected ${expectedSequence}, found ${record.sequenceNumber}`,
        });
      }

      // 2. Previous Hash Chaining Check
      if (record.previousHash !== lastRecordHash) {
        violations.push({
          sequenceNumber: record.sequenceNumber,
          recordId: record.id,
          violationType: i === 0 ? "GENESIS_INVALID" : "HASH_CHAIN_BROKEN",
          expected: lastRecordHash,
          actual: record.previousHash,
          message: `Broken hash chain link at sequence ${record.sequenceNumber}: previousHash does not match prior recordHash`,
        });
      }

      // 3. Payload Integrity Check
      const recomputedPayload = createCanonicalPayload({
        tenantId: record.tenantId,
        sequenceNumber: record.sequenceNumber,
        previousHash: record.previousHash,
        actorUserId: record.actorUserId,
        eventType: record.eventType,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        decision: record.decision,
        reasonCode: record.reasonCode,
        policyVersion: record.policyVersion,
        metadata: record.metadata,
        createdAt: record.createdAt,
      });

      const recomputedHash = sha256(recomputedPayload);
      if (record.recordHash !== recomputedHash) {
        violations.push({
          sequenceNumber: record.sequenceNumber,
          recordId: record.id,
          violationType: "PAYLOAD_TAMPERED",
          expected: recomputedHash,
          actual: record.recordHash,
          message: `Tampered payload detected at sequence ${record.sequenceNumber}: cryptographic hash mismatch`,
        });
      }

      // 4. HMAC Chain Seal Check (if key provided and seal exists)
      if (signingKey && record.chainSeal) {
        const expectedSeal = hmacSha256(record.recordHash, signingKey);
        if (record.chainSeal !== expectedSeal) {
          violations.push({
            sequenceNumber: record.sequenceNumber,
            recordId: record.id,
            violationType: "SEAL_MISMATCH",
            expected: expectedSeal,
            actual: record.chainSeal,
            message: `HMAC signature verification failed at sequence ${record.sequenceNumber}`,
          });
        }
      }

      lastRecordHash = record.recordHash;
      expectedSequence = record.sequenceNumber + 1;
    }

    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const chainHeadHash = records.length > 0 ? records[records.length - 1].recordHash : null;

    return {
      valid: violations.length === 0,
      tenantId,
      totalRecords: records.length,
      chainHeadHash,
      genesisHash: GENESIS_PREVIOUS_HASH,
      verifiedAt: new Date().toISOString(),
      durationMs,
      violations,
    };
  }

  /**
   * Generates a portable cryptographic proof bundle for an audit chain range.
   */
  public async generateProof(
    tenantId: string,
    startSeq: number = 1,
    endSeq?: number
  ): Promise<CryptographicAuditProof> {
    const records = this.chains.get(tenantId) || [];
    if (records.length === 0) {
      throw new Error(`No audit records found for tenant: ${tenantId}`);
    }

    const actualEnd = endSeq !== undefined ? Math.min(endSeq, records.length) : records.length;
    if (startSeq < 1 || startSeq > actualEnd) {
      throw new Error(`Invalid sequence range: [${startSeq}, ${actualEnd}]`);
    }

    const sliced = records.slice(startSeq - 1, actualEnd);
    const initialPreviousHash = sliced[0].previousHash;
    const terminalHash = sliced[sliced.length - 1].recordHash;

    const proofRecords = sliced.map((r) => ({
      id: r.id,
      sequenceNumber: r.sequenceNumber,
      previousHash: r.previousHash,
      recordHash: r.recordHash,
      chainSeal: r.chainSeal,
      canonicalPayload: createCanonicalPayload({
        tenantId: r.tenantId,
        sequenceNumber: r.sequenceNumber,
        previousHash: r.previousHash,
        actorUserId: r.actorUserId,
        eventType: r.eventType,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        decision: r.decision,
        reasonCode: r.reasonCode,
        policyVersion: r.policyVersion,
        metadata: r.metadata,
        createdAt: r.createdAt,
      }),
    }));

    return {
      tenantId,
      startSequence: startSeq,
      endSequence: actualEnd,
      initialPreviousHash,
      terminalHash,
      recordCount: proofRecords.length,
      records: proofRecords,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Pure offline verification of a cryptographic audit proof.
   * Can be run independently by auditors or third parties without database access.
   */
  public static verifyProof(
    proof: CryptographicAuditProof,
    signingKey?: string
  ): { valid: boolean; error?: string; recordCount: number } {
    if (!proof || !proof.records || proof.records.length === 0) {
      return { valid: false, error: "Empty or invalid proof bundle", recordCount: 0 };
    }

    let expectedPrevHash = proof.initialPreviousHash;
    let expectedSeq = proof.startSequence;

    for (let i = 0; i < proof.records.length; i++) {
      const rec = proof.records[i];

      if (rec.sequenceNumber !== expectedSeq) {
        return {
          valid: false,
          error: `Proof sequence mismatch at index ${i}: expected ${expectedSeq}, got ${rec.sequenceNumber}`,
          recordCount: proof.records.length,
        };
      }

      if (rec.previousHash !== expectedPrevHash) {
        return {
          valid: false,
          error: `Proof hash chain broken at sequence ${rec.sequenceNumber}: previousHash mismatch`,
          recordCount: proof.records.length,
        };
      }

      const recomputedHash = sha256(rec.canonicalPayload);
      if (rec.recordHash !== recomputedHash) {
        return {
          valid: false,
          error: `Proof payload hash mismatch at sequence ${rec.sequenceNumber}`,
          recordCount: proof.records.length,
        };
      }

      if (signingKey && rec.chainSeal) {
        const expectedSeal = hmacSha256(rec.recordHash, signingKey);
        if (rec.chainSeal !== expectedSeal) {
          return {
            valid: false,
            error: `Proof HMAC signature mismatch at sequence ${rec.sequenceNumber}`,
            recordCount: proof.records.length,
          };
        }
      }

      expectedPrevHash = rec.recordHash;
      expectedSeq++;
    }

    if (expectedPrevHash !== proof.terminalHash) {
      return {
        valid: false,
        error: `Terminal hash mismatch: expected ${proof.terminalHash}, got ${expectedPrevHash}`,
        recordCount: proof.records.length,
      };
    }

    return { valid: true, recordCount: proof.records.length };
  }

  /**
   * Injects simulated corruption into an audit record (used for negative security testing).
   */
  public injectTamperedRecord(
    tenantId: string,
    sequenceNumber: number,
    tamperedData: Partial<TamperEvidentAuditRecord>
  ): void {
    const records = this.chains.get(tenantId);
    if (!records) return;
    const target = records.find((r) => r.sequenceNumber === sequenceNumber);
    if (!target) return;
    Object.assign(target, tamperedData);
  }

  /**
   * Deletes a record from the chain (used for negative security testing).
   */
  public simulateDeleteRecord(tenantId: string, sequenceNumber: number): void {
    const records = this.chains.get(tenantId);
    if (!records) return;
    const index = records.findIndex((r) => r.sequenceNumber === sequenceNumber);
    if (index !== -1) {
      records.splice(index, 1);
    }
  }
}

// Global singleton pattern for Next.js Turbopack and test environment consistency
declare global {
  var __OPSENGINE_AUDIT_CHAIN_SERVICE__: AuditChainService | undefined;
}

export const globalAuditChainService: AuditChainService =
  globalThis.__OPSENGINE_AUDIT_CHAIN_SERVICE__ ?? new AuditChainService();

if (process.env.NODE_ENV !== "production") {
  globalThis.__OPSENGINE_AUDIT_CHAIN_SERVICE__ = globalAuditChainService;
}

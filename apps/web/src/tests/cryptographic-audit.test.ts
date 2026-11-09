import { describe, it, expect, beforeEach } from "vitest";
import {
  AuditChainService,
  canonicalJson,
  sha256,
  hmacSha256,
  GENESIS_PREVIOUS_HASH,
} from "../lib/audit";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const USER_A = "00000000-0000-4000-8000-000000000001";
const SIGNING_SECRET = "super-secret-tenant-signing-key-4096";

describe("Feature #33 — Cryptographic Audit Trail Verification & Tamper-Evident Hash Chaining", () => {
  let auditService: AuditChainService;

  beforeEach(() => {
    auditService = new AuditChainService();
  });

  describe("Deterministic Canonical Serialization", () => {
    it("produces identical JSON regardless of key ordering", () => {
      const obj1 = { z: 1, a: "hello", m: { y: true, x: 42 } };
      const obj2 = { a: "hello", m: { x: 42, y: true }, z: 1 };

      const canon1 = canonicalJson(obj1);
      const canon2 = canonicalJson(obj2);

      expect(canon1).toBe(canon2);
      expect(sha256(canon1)).toBe(sha256(canon2));
      expect(canon1).toBe('{"a":"hello","m":{"x":42,"y":true},"z":1}');
    });

    it("omits undefined fields and preserves arrays", () => {
      const obj = { b: 2, c: undefined, a: [1, 2, { k: "v" }] };
      const canon = canonicalJson(obj);
      expect(canon).toBe('{"a":[1,2,{"k":"v"}],"b":2}');
    });
  });

  describe("Cryptographic Hash Chain Appends", () => {
    it("initializes genesis block with 64 zeros and sequence 1", async () => {
      const rec = await auditService.appendRecord(TENANT_A, {
        actorUserId: USER_A,
        eventType: "AUTH_LOGIN_SUCCESS",
        decision: "allow",
      });

      expect(rec.sequenceNumber).toBe(1);
      expect(rec.previousHash).toBe(GENESIS_PREVIOUS_HASH);
      expect(rec.recordHash).toHaveLength(64);
      expect(rec.tenantId).toBe(TENANT_A);
    });

    it("chains subsequent records with monotonic sequences and continuous hashes", async () => {
      const rec1 = await auditService.appendRecord(TENANT_A, {
        actorUserId: USER_A,
        eventType: "USER_INVITED",
        decision: "allow",
      });

      const rec2 = await auditService.appendRecord(TENANT_A, {
        actorUserId: USER_A,
        eventType: "PROJECT_CREATED",
        resourceType: "project",
        resourceId: "00000000-0000-4000-8000-000000000101",
        decision: "allow",
      });

      const rec3 = await auditService.appendRecord(TENANT_A, {
        actorUserId: USER_A,
        eventType: "INVOICE_GENERATED",
        resourceType: "invoice",
        decision: "allow",
      });

      expect(rec1.sequenceNumber).toBe(1);
      expect(rec2.sequenceNumber).toBe(2);
      expect(rec3.sequenceNumber).toBe(3);

      expect(rec2.previousHash).toBe(rec1.recordHash);
      expect(rec3.previousHash).toBe(rec2.recordHash);
    });

    it("signs records with HMAC chain seal when signingKey is supplied", async () => {
      const rec = await auditService.appendRecord(
        TENANT_A,
        {
          actorUserId: USER_A,
          eventType: "BREAK_GLASS_SESSION_OPENED",
          decision: "allow",
        },
        SIGNING_SECRET
      );

      expect(rec.chainSeal).toBeDefined();
      expect(rec.chainSeal).toBe(hmacSha256(rec.recordHash, SIGNING_SECRET));
    });
  });

  describe("Cryptographic Integrity Verification", () => {
    it("passes verification on a clean unbroken chain", async () => {
      for (let i = 1; i <= 5; i++) {
        await auditService.appendRecord(
          TENANT_A,
          {
            actorUserId: USER_A,
            eventType: `AUDIT_EVENT_${i}`,
            decision: "allow",
            metadata: { step: i },
          },
          SIGNING_SECRET
        );
      }

      const result = await auditService.verifyChain(TENANT_A, SIGNING_SECRET);

      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(5);
      expect(result.violations).toHaveLength(0);
      expect(result.chainHeadHash).toBeDefined();
    });

    it("detects tampered payload data and pinpoints sequence number", async () => {
      for (let i = 1; i <= 4; i++) {
        await auditService.appendRecord(TENANT_A, {
          actorUserId: USER_A,
          eventType: `EVENT_${i}`,
          decision: "allow",
        });
      }

      // Maliciously tamper with record 3 (e.g. attacker changing decision)
      auditService.injectTamperedRecord(TENANT_A, 3, {
        decision: "deny",
      });

      const result = await auditService.verifyChain(TENANT_A);

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(1);

      const payloadTamperViolation = result.violations.find((v) => v.violationType === "PAYLOAD_TAMPERED");
      expect(payloadTamperViolation).toBeDefined();
      expect(payloadTamperViolation?.sequenceNumber).toBe(3);
    });

    it("detects deleted records in the middle of the chain", async () => {
      for (let i = 1; i <= 5; i++) {
        await auditService.appendRecord(TENANT_A, {
          actorUserId: USER_A,
          eventType: `EVENT_${i}`,
          decision: "allow",
        });
      }

      // Simulate malicious record deletion: remove record 3
      auditService.simulateDeleteRecord(TENANT_A, 3);

      const result = await auditService.verifyChain(TENANT_A);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.violationType === "SEQUENCE_GAP")).toBe(true);
      expect(result.violations.some((v) => v.violationType === "HASH_CHAIN_BROKEN")).toBe(true);
    });

    it("detects HMAC signature mismatch when secret does not match", async () => {
      await auditService.appendRecord(
        TENANT_A,
        {
          actorUserId: USER_A,
          eventType: "FINANCE_PAYMENT_DISBURSED",
          decision: "allow",
        },
        SIGNING_SECRET
      );

      const result = await auditService.verifyChain(TENANT_A, "wrong-fraudulent-signing-key");

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.violationType === "SEAL_MISMATCH")).toBe(true);
    });
  });

  describe("Cryptographic Proofs & Offline Auditor Verification", () => {
    it("generates portable proof bundle and verifies offline without database", async () => {
      for (let i = 1; i <= 6; i++) {
        await auditService.appendRecord(
          TENANT_A,
          {
            actorUserId: USER_A,
            eventType: `TRANSACTION_${i}`,
            decision: "allow",
            metadata: { txId: `tx-${i}` },
          },
          SIGNING_SECRET
        );
      }

      // Generate proof for sequence range [2, 5]
      const proof = await auditService.generateProof(TENANT_A, 2, 5);

      expect(proof.tenantId).toBe(TENANT_A);
      expect(proof.startSequence).toBe(2);
      expect(proof.endSequence).toBe(5);
      expect(proof.recordCount).toBe(4);
      expect(proof.records).toHaveLength(4);

      // Verify proof offline using static method
      const verification = AuditChainService.verifyProof(proof, SIGNING_SECRET);
      expect(verification.valid).toBe(true);
      expect(verification.recordCount).toBe(4);
    });

    it("rejects offline proof if any record in the proof is tampered", async () => {
      for (let i = 1; i <= 3; i++) {
        await auditService.appendRecord(TENANT_A, {
          actorUserId: USER_A,
          eventType: `RECORD_${i}`,
          decision: "allow",
        });
      }

      const proof = await auditService.generateProof(TENANT_A, 1, 3);

      // Tamper with record in proof bundle
      proof.records[1].recordHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const verification = AuditChainService.verifyProof(proof);
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain("Proof payload hash mismatch");

      // Also test broken previousHash chaining
      const proof2 = await auditService.generateProof(TENANT_A, 1, 3);
      proof2.records[2].previousHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const verification2 = AuditChainService.verifyProof(proof2);
      expect(verification2.valid).toBe(false);
      expect(verification2.error).toContain("Proof hash chain broken");
    });
  });

  describe("Concurrent Append Serialization", () => {
    it("guarantees monotonic ordering and zero race conditions under concurrent appends", async () => {
      const concurrentWrites = 15;
      const promises = Array.from({ length: concurrentWrites }).map((_, idx) =>
        auditService.appendRecord(TENANT_A, {
          actorUserId: USER_A,
          eventType: `CONCURRENT_EVENT_${idx + 1}`,
          decision: "allow",
        })
      );

      const records = await Promise.all(promises);

      expect(records).toHaveLength(concurrentWrites);

      // Verify chain integrity
      const result = await auditService.verifyChain(TENANT_A);
      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(concurrentWrites);
      expect(result.violations).toHaveLength(0);

      // Verify strict contiguous ordering
      for (let i = 0; i < records.length; i++) {
        expect(records[i].sequenceNumber).toBe(i + 1);
        if (i > 0) {
          expect(records[i].previousHash).toBe(records[i - 1].recordHash);
        }
      }
    });
  });

  describe("Cross-Tenant Isolation", () => {
    it("strictly isolates audit chains between Tenant A and Tenant B", async () => {
      await auditService.appendRecord(TENANT_A, {
        actorUserId: USER_A,
        eventType: "TENANT_A_CONFIDENTIAL_EVENT",
        decision: "allow",
      });

      await auditService.appendRecord(TENANT_B, {
        actorUserId: "usr-b",
        eventType: "TENANT_B_CONFIDENTIAL_EVENT",
        decision: "allow",
      });

      const recordsA = await auditService.getRecords(TENANT_A);
      const recordsB = await auditService.getRecords(TENANT_B);

      expect(recordsA.total).toBe(1);
      expect(recordsA.records[0].eventType).toBe("TENANT_A_CONFIDENTIAL_EVENT");

      expect(recordsB.total).toBe(1);
      expect(recordsB.records[0].eventType).toBe("TENANT_B_CONFIDENTIAL_EVENT");

      // Verify chains separately
      const verifyA = await auditService.verifyChain(TENANT_A);
      const verifyB = await auditService.verifyChain(TENANT_B);

      expect(verifyA.valid).toBe(true);
      expect(verifyB.valid).toBe(true);
      expect(verifyA.totalRecords).toBe(1);
      expect(verifyB.totalRecords).toBe(1);

      // Cross-tenant negative assertion: Tenant B proof cannot be generated from Tenant A
      await expect(auditService.generateProof(TENANT_B, 10, 20)).rejects.toThrow();
    });
  });
});

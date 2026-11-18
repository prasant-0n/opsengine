import { describe, it, expect } from "vitest";
import {
  centsToDecimal,
  calculatePayloadIdempotencyKey,
  transformInvoiceToQuickBooks,
  transformInvoiceToXero,
  transformPaymentToQuickBooks,
  transformPaymentToXero,
  syncInvoiceToErp,
  syncPaymentToErp,
  InvoiceEntity,
  PaymentEntity,
  ChartOfAccountsMapping,
} from "../features/erp-sync/lib/erp-engine";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { scopeAllows, ResourceScope } from "../lib/permissions/scopes";
import { authorize } from "../lib/permissions/engine";
import type { AuthorizationContext } from "../lib/permissions/context";

describe("Feature #43: Accounting ERP Sync (QuickBooks & Xero)", () => {
  const sampleInvoice: InvoiceEntity = {
    id: "00000000-0000-4000-8000-000000000111",
    number: "INV-2026-001",
    tenantId: "00000000-0000-4000-8000-000000000001",
    accountId: "00000000-0000-4000-8000-000000000222",
    accountName: "Acme Global Enterprise",
    status: "issued",
    totalCents: 150000n, // $1,500.00
    balanceCents: 150000n,
    currency: "USD",
    issuedAt: "2026-11-18T00:00:00.000Z",
    dueAt: "2026-12-18T00:00:00.000Z",
    lines: [
      {
        id: "line-1",
        description: "Cloud Architecture Implementation",
        quantity: 10,
        unitPriceCents: 15000n, // $150.00
        totalCents: 150000n, // $1,500.00
      },
    ],
  };

  const sampleCoaMapping: ChartOfAccountsMapping = {
    revenueAccountCode: "4000",
    receivablesAccountCode: "1100",
    salesTaxAccountCode: "2200",
    bankDepositAccountCode: "1000",
  };

  describe("1. Currency & Integer Cent Conversion", () => {
    it("converts integer cents (number and BigInt) to floating decimal currency", () => {
      expect(centsToDecimal(0)).toBe(0.0);
      expect(centsToDecimal(100)).toBe(1.0);
      expect(centsToDecimal(15050)).toBe(150.5);
      expect(centsToDecimal(150000n)).toBe(1500.0);
      expect(centsToDecimal(99999999n)).toBe(999999.99);
    });
  });

  describe("2. Cryptographic Idempotency Hash Engine", () => {
    it("computes deterministic SHA-256 hash for identical payloads", () => {
      const hash1 = calculatePayloadIdempotencyKey(sampleInvoice);
      const hash2 = calculatePayloadIdempotencyKey(sampleInvoice);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("generates distinct hash if any financial amount or line item changes", () => {
      const modifiedInvoice = {
        ...sampleInvoice,
        totalCents: 150001n,
      };

      const originalHash = calculatePayloadIdempotencyKey(sampleInvoice);
      const modifiedHash = calculatePayloadIdempotencyKey(modifiedInvoice);

      expect(originalHash).not.toBe(modifiedHash);
    });
  });

  describe("3. QuickBooks Online (QBO) Transformation", () => {
    it("transforms OpsEngine Invoice into compliant QuickBooks Online DTO", () => {
      const qbo = transformInvoiceToQuickBooks(sampleInvoice, sampleCoaMapping);

      expect(qbo.DocNumber).toBe("INV-2026-001");
      expect(qbo.TxnDate).toBe("2026-11-18");
      expect(qbo.DueDate).toBe("2026-12-18");
      expect(qbo.CustomerRef.value).toBe(sampleInvoice.accountId);
      expect(qbo.CustomerRef.name).toBe("Acme Global Enterprise");
      expect(qbo.TotalAmt).toBe(1500.0);
      expect(qbo.Line.length).toBe(1);

      const line = qbo.Line[0]!;
      expect(line.Amount).toBe(1500.0);
      expect(line.DetailType).toBe("SalesItemLineDetail");
      expect(line.SalesItemLineDetail.UnitPrice).toBe(150.0);
      expect(line.SalesItemLineDetail.Qty).toBe(10);
      expect(line.SalesItemLineDetail.ItemRef?.value).toBe("4000");
    });

    it("transforms payment reconciliation into QuickBooks payment DTO", () => {
      const payment: PaymentEntity = {
        id: "pmt-001",
        tenantId: sampleInvoice.tenantId,
        invoiceId: sampleInvoice.id,
        amountCents: 75000n, // $750.00
        paymentMethod: "stripe",
        reference: "ch_test_12345",
        recordedAt: "2026-11-18T10:00:00Z",
      };

      const qboPmt = transformPaymentToQuickBooks(payment, "QBO-INV-999", sampleInvoice.accountId);
      expect(qboPmt.TotalAmt).toBe(750.0);
      expect(qboPmt.CustomerRef.value).toBe(sampleInvoice.accountId);
      expect(qboPmt.Line[0]?.Amount).toBe(750.0);
      expect(qboPmt.Line[0]?.LinkedTxn[0]?.TxnId).toBe("QBO-INV-999");
      expect(qboPmt.Line[0]?.LinkedTxn[0]?.TxnType).toBe("Invoice");
    });
  });

  describe("4. Xero Invoices & General Ledger Transformation", () => {
    it("transforms OpsEngine Invoice into compliant Xero DTO", () => {
      const xero = transformInvoiceToXero(sampleInvoice, sampleCoaMapping);

      expect(xero.Type).toBe("ACCREC");
      expect(xero.InvoiceNumber).toBe("INV-2026-001");
      expect(xero.Date).toBe("2026-11-18");
      expect(xero.DueDate).toBe("2026-12-18");
      expect(xero.Contact.ContactNumber).toBe(sampleInvoice.accountId);
      expect(xero.Contact.Name).toBe("Acme Global Enterprise");
      expect(xero.Status).toBe("AUTHORISED");
      expect(xero.LineItems.length).toBe(1);

      const line = xero.LineItems[0]!;
      expect(line.Description).toBe("Cloud Architecture Implementation");
      expect(line.Quantity).toBe(10);
      expect(line.UnitAmount).toBe(150.0);
      expect(line.LineAmount).toBe(1500.0);
      expect(line.AccountCode).toBe("4000");
    });

    it("transforms payment reconciliation into Xero payment DTO", () => {
      const payment: PaymentEntity = {
        id: "pmt-002",
        tenantId: sampleInvoice.tenantId,
        invoiceId: sampleInvoice.id,
        amountCents: 150000n, // $1,500.00
        paymentMethod: "ach",
        reference: "ACH-DEP-883",
        recordedAt: "2026-11-18T12:00:00Z",
      };

      const xeroPmt = transformPaymentToXero(payment, "XERO-INV-555", sampleCoaMapping);
      expect(xeroPmt.Invoice.InvoiceID).toBe("XERO-INV-555");
      expect(xeroPmt.Amount).toBe(1500.0);
      expect(xeroPmt.Account.Code).toBe("1000");
      expect(xeroPmt.Reference).toBe("ACH-DEP-883");
    });
  });

  describe("5. High-Level Sync Dispatcher & Error Guardrails", () => {
    it("successfully dispatches invoice sync to QuickBooks with deterministic external ID", async () => {
      const result = await syncInvoiceToErp("quickbooks", sampleInvoice, sampleCoaMapping);
      expect(result.success).toBe(true);
      expect(result.externalId).toContain("QBO-INV-INV-2026-001");
      expect(result.idempotencyKey).toBeDefined();
    });

    it("successfully dispatches invoice sync to Xero with deterministic external ID", async () => {
      const result = await syncInvoiceToErp("xero", sampleInvoice, sampleCoaMapping);
      expect(result.success).toBe(true);
      expect(result.externalId).toContain("XERO-INV-INV-2026-001");
      expect(result.idempotencyKey).toBeDefined();
    });

    it("blocks sync attempts for invoices without line items", async () => {
      const emptyInvoice = { ...sampleInvoice, lines: [] };
      const result = await syncInvoiceToErp("quickbooks", emptyInvoice);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot synchronize invoice without line items");
    });

    it("dispatches payment reconciliation to ERP provider", async () => {
      const payment: PaymentEntity = {
        id: "pmt-003",
        tenantId: sampleInvoice.tenantId,
        invoiceId: sampleInvoice.id,
        amountCents: 50000n,
        paymentMethod: "stripe",
      };

      const result = await syncPaymentToErp(
        "quickbooks",
        payment,
        "QBO-INV-111",
        sampleInvoice.accountId,
        sampleCoaMapping
      );
      expect(result.success).toBe(true);
      expect(result.externalId).toContain("QBO-PMT-pmt-003");
    });
  });

  describe("6. ReBAC Scoping & Strict Cross-Tenant Negative Isolation", () => {
    const tenantA = "00000000-0000-4000-8000-000000000001";
    const tenantB = "00000000-0000-4000-8000-000000000002";
    const employeeFinance = "11111111-1111-4000-8000-111111111111";

    const financeContext: AuthorizationContext = {
      tenantId: tenantA,
      userId: "user-fin",
      employeeId: employeeFinance,
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        {
          key: PERMISSIONS.ERP_CONFIG_MANAGE,
          scopeType: "TENANT",
          scopeId: null,
          validTo: null,
        },
        {
          key: PERMISSIONS.ERP_SYNC_READ,
          scopeType: "TENANT",
          scopeId: null,
          validTo: null,
        },
        {
          key: PERMISSIONS.ERP_SYNC_EXECUTE,
          scopeType: "TENANT",
          scopeId: null,
          validTo: null,
        },
      ],
      roles: [{ key: "finance", scopeType: "TENANT", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    it("allows finance officer to manage ERP configurations under TENANT scope", () => {
      const resource: ResourceScope = {
        tenantId: tenantA,
        owningEmployeeId: employeeFinance,
      };

      const isAllowed = scopeAllows(financeContext, "TENANT", null, resource);
      expect(isAllowed).toBe(true);
    });

    it("denies unauthorized employee from configuring ERP integrations", () => {
      const devContext: AuthorizationContext = {
        tenantId: tenantA,
        userId: "user-dev",
        employeeId: "22222222-2222-4000-8000-222222222222",
        membershipStatus: "active",
        assurance: { mfa: false },
        permissions: [],
        roles: [{ key: "employee", scopeType: "SELF", scopeId: null }],
        teamMemberships: [],
        reporting: { managerIds: [], reportIds: [] },
        accessGroupIds: [],
        policyVersion: 1,
        builtAt: Date.now(),
      };

      const decision = authorize(devContext, PERMISSIONS.ERP_CONFIG_MANAGE, {
        tenantId: tenantA,
        resourceType: "erp_integration",
      });

      expect(decision.allowed).toBe(false);
    });

    it("strictly isolates ERP integrations across tenant boundaries", () => {
      const tenantBResource = {
        tenantId: tenantB,
        resourceType: "erp_integration",
      };

      const decision = authorize(financeContext, PERMISSIONS.ERP_CONFIG_MANAGE, tenantBResource);
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("TENANT_MISMATCH");
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getR2Config,
  buildR2Endpoint,
  getTenantStorageKey,
  getR2Client,
  uploadDocument,
  getPresignedDownloadUrl,
  deleteDocument,
} from "../lib/storage/r2-client";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

describe("Cloudflare R2 Object Storage Adapter (Zero-Cost / Zero AWS S3)", () => {
  const mockEnv: Record<string, string> = {
    CLOUDFLARE_R2_ACCOUNT_ID: "a1b2c3d4e5f67890abcdef1234567890",
    CLOUDFLARE_R2_ACCESS_KEY_ID: "test-r2-access-key",
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: "test-r2-secret-key",
    CLOUDFLARE_R2_BUCKET_NAME: "opsengine-documents-prod",
    CLOUDFLARE_R2_PUBLIC_URL: "https://documents.opsengine.enterprise",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Configuration and Endpoint Resolution", () => {
    it("resolves official Cloudflare R2 endpoint correctly", () => {
      const endpoint = buildR2Endpoint("test-account-123");
      expect(endpoint).toBe("https://test-account-123.r2.cloudflarestorage.com");
      expect(endpoint).not.toContain("amazonaws.com");
    });

    it("parses environment configuration with custom bucket and public URL", () => {
      const config = getR2Config(mockEnv);
      expect(config.accountId).toBe("a1b2c3d4e5f67890abcdef1234567890");
      expect(config.accessKeyId).toBe("test-r2-access-key");
      expect(config.secretAccessKey).toBe("test-r2-secret-key");
      expect(config.bucketName).toBe("opsengine-documents-prod");
      expect(config.endpoint).toBe("https://a1b2c3d4e5f67890abcdef1234567890.r2.cloudflarestorage.com");
      expect(config.publicUrl).toBe("https://documents.opsengine.enterprise");
      expect(config.isConfigured).toBe(true);
    });

    it("uses default bucket name when not specified", () => {
      const config = getR2Config({});
      expect(config.bucketName).toBe("opsengine-documents");
      expect(config.isConfigured).toBe(false);
    });
  });

  describe("2. Multi-Tenant Key Isolation", () => {
    it("formats strict tenant-isolated key paths", () => {
      const tenantId = "b9f93933-2895-46aa-bd47-f7ca401340a6";
      const key = getTenantStorageKey(tenantId, "resumes/candidate-101.pdf");
      expect(key).toBe(`tenants/${tenantId}/resumes/candidate-101.pdf`);
    });

    it("strips leading slashes from subpath to maintain canonical pathing", () => {
      const tenantId = "b9f93933-2895-46aa-bd47-f7ca401340a6";
      const key = getTenantStorageKey(tenantId, "///invoices/inv-2026.pdf");
      expect(key).toBe(`tenants/${tenantId}/invoices/inv-2026.pdf`);
    });

    it("throws error when tenantId is empty or missing", () => {
      expect(() => getTenantStorageKey("", "docs/test.pdf")).toThrowError(
        "Tenant ID is required for storage key generation"
      );
    });
  });

  describe("3. Client Instantiation", () => {
    it("creates an S3Client configured with region 'auto' for Cloudflare R2", () => {
      const client = getR2Client({
        accountId: "a1b2c3d4e5f67890abcdef1234567890",
        endpoint: "https://a1b2c3d4e5f67890abcdef1234567890.r2.cloudflarestorage.com",
      });

      expect(client).toBeInstanceOf(S3Client);
    });
  });

  describe("4. Document Upload, Presigned URLs and Deletion (Mock Mode)", () => {
    it("uploads document with fallback mock metadata when unconfigured", async () => {
      const result = await uploadDocument({
        key: "tenants/test-tenant/docs/report.txt",
        content: "OpsEngine Cloudflare R2 Migration",
        contentType: "text/plain",
      });

      expect(result.key).toBe("tenants/test-tenant/docs/report.txt");
      expect(result.size).toBe(33);
      expect(result.etag).toBeDefined();
    });

    it("generates presigned download url safely", async () => {
      const url = await getPresignedDownloadUrl({
        key: "tenants/test-tenant/docs/report.txt",
        expiresInSeconds: 1800,
      });

      expect(url).toContain("report.txt");
      expect(url).toContain("1800");
    });

    it("deletes document successfully", async () => {
      const result = await deleteDocument({
        key: "tenants/test-tenant/docs/report.txt",
      });

      expect(result.key).toBe("tenants/test-tenant/docs/report.txt");
      expect(result.deleted).toBe(true);
    });
  });

  describe("5. Live S3 Command Dispatch Verification", () => {
    it("dispatches PutObjectCommand to Cloudflare R2 when client is invoked", async () => {
      const mockSend = vi.fn().mockResolvedValue({ ETag: '"cf-r2-etag-123"' });
      const mockClient = {
        send: mockSend,
      } as unknown as S3Client;

      const result = await uploadDocument(
        {
          bucket: "custom-bucket",
          key: "tenants/t1/avatar.png",
          content: Buffer.from("image-bytes"),
          contentType: "image/png",
          metadata: { author: "devops" },
        },
        mockClient
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      const sentCommand = mockSend.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(PutObjectCommand);
      expect(sentCommand.input.Bucket).toBe("custom-bucket");
      expect(sentCommand.input.Key).toBe("tenants/t1/avatar.png");
      expect(sentCommand.input.ContentType).toBe("image/png");
      expect(result.etag).toBe('"cf-r2-etag-123"');
    });

    it("dispatches DeleteObjectCommand to Cloudflare R2", async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockClient = {
        send: mockSend,
      } as unknown as S3Client;

      const result = await deleteDocument(
        {
          bucket: "custom-bucket",
          key: "tenants/t1/avatar.png",
        },
        mockClient
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      const sentCommand = mockSend.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(DeleteObjectCommand);
      expect(sentCommand.input.Bucket).toBe("custom-bucket");
      expect(sentCommand.input.Key).toBe("tenants/t1/avatar.png");
      expect(result.deleted).toBe(true);
    });
  });
});

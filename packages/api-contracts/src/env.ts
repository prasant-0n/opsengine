/**
 * Cloud Infrastructure Environment Contract & Variable Definitions
 * 100% Zero-Cost Architecture (Neon Serverless Postgres + Cloudflare R2 + Vercel)
 */

export interface DatabaseEnv {
  /**
   * Pooled PostgreSQL connection URL (Neon PgBouncer connection string).
   * Typically uses port 6543 or pooler hostname with sslmode=require.
   * Used for application queries and serverless runtime.
   */
  DATABASE_URL: string;

  /**
   * Direct PostgreSQL connection URL (Neon direct compute connection string).
   * Bypasses connection poolers for schema migrations, DDL, and administrative tasks.
   * Required for `prisma migrate deploy` on serverless Neon Postgres.
   */
  DIRECT_URL?: string;
}

export interface CloudflareR2Env {
  /**
   * Cloudflare Account Identifier (32-character hexadecimal string).
   */
  CLOUDFLARE_R2_ACCOUNT_ID?: string;

  /**
   * Cloudflare R2 S3 API Access Key ID.
   */
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;

  /**
   * Cloudflare R2 S3 API Secret Access Key.
   */
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;

  /**
   * Primary Cloudflare R2 Bucket Name (default: 'opsengine-documents').
   */
  CLOUDFLARE_R2_BUCKET_NAME?: string;

  /**
   * Optional custom public CDN or dev domain URL for public asset delivery.
   */
  CLOUDFLARE_R2_PUBLIC_URL?: string;
}

export interface CloudDevOpsEnv extends DatabaseEnv, CloudflareR2Env {
  NODE_ENV?: "development" | "production" | "test";
  NEXT_PUBLIC_APP_URL?: string;
}

/**
 * Validates and resolves Neon serverless Postgres connection options.
 */
export function resolveDatabaseConfig(env: Record<string, string | undefined> = process.env): {
  databaseUrl: string;
  directUrl: string;
  isPooled: boolean;
} {
  const databaseUrl = env.DATABASE_URL || "";
  const directUrl = env.DIRECT_URL || databaseUrl;
  const isPooled = databaseUrl.includes("-pooler") || databaseUrl.includes("pgbouncer=true");

  return {
    databaseUrl,
    directUrl,
    isPooled,
  };
}

/**
 * Validates and resolves Cloudflare R2 configuration with S3 endpoint.
 */
export function resolveR2Config(env: Record<string, string | undefined> = process.env): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicUrl?: string;
  isConfigured: boolean;
} {
  const accountId = env.CLOUDFLARE_R2_ACCOUNT_ID || "";
  const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID || "";
  const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "";
  const bucketName = env.CLOUDFLARE_R2_BUCKET_NAME || "opsengine-documents";
  const publicUrl = env.CLOUDFLARE_R2_PUBLIC_URL;

  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey);
  const endpoint = accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : "https://mock-account-id.r2.cloudflarestorage.com";

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    publicUrl,
    isConfigured,
  };
}

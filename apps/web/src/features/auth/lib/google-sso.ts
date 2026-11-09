import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { writeAuditAsync } from "@/lib/permissions/audit";

export interface GoogleOAuthStatePayload {
  csrf: string;
  domain?: string;
  tenantId?: string;
  returnTo?: string;
  exp: number;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleSSOResult {
  sessionToken: string;
  expiresAt: Date;
  tenantId: string;
  userId: string;
  email: string;
  returnTo: string;
}

function getOAuthSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "opsengine-oauth-secure-secret-minimum-32chars!"
  );
}

/**
 * Sanitizes returnTo path to prevent Open Redirect vulnerabilities.
 * Only allows absolute paths starting with / and not // or /\\
 */
export function sanitizeReturnTo(url?: string | null): string {
  if (!url || typeof url !== "string") return "/dashboard";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes("://")
  ) {
    return trimmed;
  }
  return "/dashboard";
}

/**
 * Generates an HMAC-SHA256 signed OAuth state token containing CSRF token and expiration.
 */
export function createGoogleOAuthState(input?: {
  domain?: string;
  tenantId?: string;
  returnTo?: string;
}): string {
  const payload: GoogleOAuthStatePayload = {
    csrf: crypto.randomBytes(16).toString("hex"),
    domain: input?.domain?.trim() || undefined,
    tenantId: input?.tenantId?.trim() || undefined,
    returnTo: sanitizeReturnTo(input?.returnTo),
    exp: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", getOAuthSecret())
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${hmac}`;
}

/**
 * Verifies the HMAC-SHA256 signature and expiration of an OAuth state token.
 */
export function verifyGoogleOAuthState(
  stateStr: string
): GoogleOAuthStatePayload | null {
  if (!stateStr || typeof stateStr !== "string") return null;
  const parts = stateStr.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expectedHmac = crypto
    .createHmac("sha256", getOAuthSecret())
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedHmac);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(raw) as GoogleOAuthStatePayload;
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Constructs the Google OAuth 2.0 authorization URL.
 */
export function getGoogleAuthUrl(options: {
  state: string;
  redirectUri: string;
  clientId?: string;
}): string {
  const clientId = options.clientId || process.env.GOOGLE_CLIENT_ID || "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: options.state,
    access_type: "offline",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges Google authorization code for OAuth tokens.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  options?: { clientId?: string; clientSecret?: string }
): Promise<{ accessToken: string; idToken?: string }> {
  const clientId = options?.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = options?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CREDENTIALS_MISSING");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`GOOGLE_TOKEN_EXCHANGE_FAILED: ${errorBody}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
  };
}

/**
 * Fetches user profile from Google's UserInfo endpoint.
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("GOOGLE_USERINFO_FAILED");
  }

  const data = await res.json();
  return {
    sub: data.sub,
    email: data.email,
    email_verified: Boolean(data.email_verified),
    name: data.name,
    picture: data.picture,
  };
}

/**
 * Completes the SSO login flow: verifies tenant scoping, ensures active membership,
 * links OAuth identity, logs audit record, and issues an active session.
 */
export async function completeGoogleSSOFlow(input: {
  profile: GoogleProfile;
  domain?: string;
  tenantId?: string;
  returnTo?: string;
}): Promise<GoogleSSOResult> {
  const { profile, domain, tenantId, returnTo } = input;

  if (!profile.email_verified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const normalizedEmail = profile.email.toLowerCase().trim();

  // 1. Resolve Tenant Workspace
  let targetTenantId = tenantId;

  if (!targetTenantId && domain) {
    const workspace = await prisma.tenantWorkspace.findFirst({
      where: {
        OR: [{ domain }, { slug: domain }],
        isActive: true,
      },
    });
    if (!workspace) {
      throw new Error("TENANT_NOT_FOUND");
    }
    targetTenantId = workspace.tenantId;
  }

  // 2. Resolve AuthUser within tenant scope
  let user;
  if (targetTenantId) {
    user = await prisma.authUser.findFirst({
      where: {
        tenantId: targetTenantId,
        email: normalizedEmail,
      },
    });
  } else {
    // If no domain hint was provided at start, look for an active user across tenants
    const users = await prisma.authUser.findMany({
      where: { email: normalizedEmail },
    });

    if (users.length === 0) {
      throw new Error("USER_NOT_ENROLLED");
    }

    if (users.length === 1) {
      user = users[0];
      targetTenantId = user.tenantId;
    } else {
      // Multiple tenants found: pick the one with active workspace & membership
      for (const candidate of users) {
        const ws = await prisma.tenantWorkspace.findFirst({
          where: { tenantId: candidate.tenantId, isActive: true },
        });
        if (ws) {
          const mem = await prisma.tenantMembership.findUnique({
            where: {
              tenantId_userId: { tenantId: candidate.tenantId, userId: candidate.id },
            },
          });
          if (mem && mem.status === "active") {
            user = candidate;
            targetTenantId = candidate.tenantId;
            break;
          }
        }
      }
    }
  }

  if (!user || !targetTenantId) {
    throw new Error("USER_NOT_ENROLLED");
  }

  // Verify workspace is active
  const activeWorkspace = await prisma.tenantWorkspace.findFirst({
    where: { tenantId: targetTenantId, isActive: true },
  });
  if (!activeWorkspace) {
    throw new Error("TENANT_INACTIVE");
  }

  // 3. Verify TenantMembership is strictly active
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_userId: { tenantId: targetTenantId, userId: user.id },
    },
  });

  if (!membership || membership.status !== "active") {
    throw new Error("MEMBERSHIP_INACTIVE");
  }

  // 4. Update / link OAuth subject on AuthUser
  await prisma.authUser.update({
    where: { id: user.id },
    data: {
      oauthProvider: "google",
      oauthSubject: profile.sub,
    },
  });

  // 5. Append-only Audit Log
  await writeAuditAsync({
    tenantId: targetTenantId,
    actorUserId: user.id,
    eventType: "AUTH_SSO_LOGIN",
    resourceType: "AUTH_SESSION",
    resourceId: user.id,
    decision: "allow",
    metadata: {
      provider: "google",
      email: normalizedEmail,
      googleSub: profile.sub,
      name: profile.name ?? null,
    },
  });

  // 6. Issue secure session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tenantId: targetTenantId,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  return {
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    tenantId: targetTenantId,
    userId: user.id,
    email: user.email,
    returnTo: sanitizeReturnTo(returnTo),
  };
}

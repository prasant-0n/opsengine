import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "./session-cookie";
import { prisma } from "@/lib/prisma";

export interface PortalSessionContext {
  tenantId: string;
  accountId: string;
  accountName: string;
  contactId: string | null;
  contactName: string;
  contactEmail: string;
  userId: string;
  isStaff: boolean;
}

export type PortalAuthResult =
  | { success: true; ctx: PortalSessionContext }
  | { success: false; response: NextResponse };

/**
 * Resolves customer portal caller context.
 * Strict multi-tenant and account scoping:
 * - Client contact is bound to their specific crm_account.
 * - Staff/Admins can view portal for a specific account via x-portal-account-id or ?accountId.
 * - Cross-tenant IDOR is strictly blocked with 403 Forbidden.
 */
export async function resolvePortalSession(
  req: NextRequest
): Promise<PortalAuthResult> {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const cookieToken = await getSessionToken();
  const token = bearerToken || cookieToken;

  if (!token) {
    return {
      success: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const session = await prisma.session.findUnique({
    where: { token },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return {
      success: false,
      response: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }),
    };
  }

  const { tenantId, userId } = session;

  const user = await prisma.authUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return {
      success: false,
      response: NextResponse.json({ error: "User not found" }, { status: 401 }),
    };
  }

  // Check if caller is an internal employee
  const employee = await prisma.employee.findFirst({
    where: { tenantId, userId },
  });
  const isStaff = !!employee;

  // Check for linked CRM Contact by email or explicit header/query parameter
  const searchParams = req.nextUrl?.searchParams || new URL(req.url).searchParams;
  const requestedAccountId =
    req.headers.get("x-portal-account-id") ||
    searchParams.get("accountId") ||
    null;

  let contact = await prisma.crmContact.findFirst({
    where: { tenantId, email: user.email },
  });

  let accountId: string | null = null;

  if (contact) {
    accountId = contact.accountId;
    // If staff caller specified a different account, allow only if staff
    if (isStaff && requestedAccountId) {
      accountId = requestedAccountId;
    }
  } else if (isStaff) {
    // Staff member accessing portal
    if (requestedAccountId) {
      accountId = requestedAccountId;
    } else {
      const firstAccount = await prisma.crmAccount.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });
      accountId = firstAccount?.id ?? null;
    }
  }

  if (!accountId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "No client account associated with this user" },
        { status: 403 }
      ),
    };
  }

  // Authoritative Cross-Tenant IDOR check: Account must belong to tenantId
  const account = await prisma.crmAccount.findFirst({
    where: { id: accountId, tenantId },
  });

  if (!account) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Account not found or access denied" },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    ctx: {
      tenantId,
      accountId: account.id,
      accountName: account.name,
      contactId: contact?.id ?? null,
      contactName: contact?.fullName ?? (employee?.displayName || user.email),
      contactEmail: contact?.email ?? user.email,
      userId,
      isStaff,
    },
  };
}

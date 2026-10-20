import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../crypto";

const prisma = new PrismaClient();

export async function logoutUseCase(sessionToken: string) {
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new Error("Not authenticated");
  }
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date(), revokedBy: session.userId },
  });
  return { revoked: true };
}

export async function listSessionsUseCase(sessionToken: string) {
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new Error("Not authenticated");
  }
  const sessions = await prisma.session.findMany({
    where: {
      tenantId: session.tenantId,
      userId: session.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      userAgent: s.userAgent ?? null,
      current: s.id === session.id,
    })),
  };
}

export async function revokeSessionUseCase(
  sessionToken: string,
  targetSessionId: string,
) {
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new Error("Not authenticated");
  }
  // Scoped to the authenticated user's tenant — cross-tenant IDs return not-found.
  const target = await prisma.session.findFirst({
    where: {
      id: targetSessionId,
      tenantId: session.tenantId,
      userId: session.userId,
      revokedAt: null,
    },
  });
  if (!target) {
    throw new Error("Not found");
  }
  await prisma.session.update({
    where: { id: target.id },
    data: { revokedAt: new Date(), revokedBy: session.userId },
  });
  return { revoked: true };
}

// ADR-006: reset-token consumption. Atomically consumes the token, sets the
// new password, and revokes all sessions for that user in that tenant.
export async function resetPasswordUseCase(input: {
  resetToken: string;
  newPassword: string;
}) {
  const { resetToken, newPassword } = input;
  if (!resetToken || typeof newPassword !== "string" || newPassword.length < 8) {
    throw new Error("Invalid request");
  }

  const token = await prisma.resetToken.findFirst({
    where: {
      token: resetToken,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!token) {
    throw new Error("Invalid or expired reset token");
  }

  // Atomic consume — updateMany with usedAt:null guard prevents race double-use
  const consumed = await prisma.resetToken.updateMany({
    where: { token: resetToken, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count === 0) {
    throw new Error("Invalid or expired reset token");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.authUser.update({
    where: { id: token.userId },
    data: { passwordHash },
  });

  // Revoke all sessions for this user in this tenant (PRD: session revocation)
  await prisma.session.updateMany({
    where: { tenantId: token.tenantId, userId: token.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { ok: true };
}

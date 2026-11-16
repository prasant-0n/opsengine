import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

export interface SessionData {
  id: string;
  userId: string;
  tenantId: string;
  roles: string[];
  expiresAt: Date;
}

export async function createSession(input: {
  userId: string;
  tenantId: string;
  roles: string[];
}): Promise<SessionData> {
  const session: SessionData = {
    id: crypto.randomUUID(),
    userId: input.userId,
    tenantId: input.tenantId,
    roles: input.roles,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  };

  await prisma.session.create({
    data: {
      id: session.id,
      userId: session.userId,
      tenantId: session.tenantId,
      token: session.id,
      expiresAt: session.expiresAt,
    },
  });

  return session;
}

export async function setSessionCookie(session: SessionData): Promise<void> {
  // Cookie is set via Next.js response headers in API routes.
  // This helper is reserved for server-side cookie utilities if needed.
  return;
}

export async function getSessionFromCookie(token: string): Promise<SessionData | null> {
  const s = await prisma.session.findUnique({ where: { token } });
  if (!s) return null;
  return {
    id: s.id,
    userId: s.userId,
    tenantId: s.tenantId,
    roles: [],
    expiresAt: s.expiresAt,
  };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.delete({ where: { token } });
}

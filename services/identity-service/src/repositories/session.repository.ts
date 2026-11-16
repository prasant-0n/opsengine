import { PrismaClient } from "@prisma/client";
import type { SessionRow } from "./types";

const prisma = new PrismaClient();

export class SessionRepository {
  async createSession(input: SessionRow): Promise<void> {
    await prisma.session.create({
      data: {
        id: input.id,
        userId: input.user_id,
        tenantId: input.tenant_id,
        token: input.token,
        expiresAt: input.expires_at,
      },
    });
  }

  async getSession(token: string): Promise<SessionRow | null> {
    const s = await prisma.session.findUnique({
      where: { token },
    });
    if (!s) return null;
    return {
      id: s.id,
      user_id: s.userId,
      tenant_id: s.tenantId,
      token: s.token,
      expires_at: s.expiresAt,
    };
  }

  async revokeSession(token: string): Promise<void> {
    await prisma.session.delete({
      where: { token },
    });
  }
}

export const sessionRepository = new SessionRepository();

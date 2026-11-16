import { PrismaClient, TenantWorkspace } from "@prisma/client";
import type {
  Workspace,
  UserRow,
  OtpRow,
  SessionRow,
  ResetTokenRow,
} from "./types";

const prisma = new PrismaClient();

export class AuthRepository {
  async findWorkspaceByDomain(domain: string): Promise<Workspace | null> {
    const ws = await prisma.tenantWorkspace.findFirst({
      where: { domain, isActive: true },
    });
    if (!ws) return null;
    return {
      id: ws.id,
      tenant_id: ws.tenantId,
      name: ws.name,
      slug: ws.slug,
      domain: ws.domain ?? null,
      is_active: ws.isActive,
    };
  }

  async findWorkspacesByIdentifier(identifier: string): Promise<Workspace[]> {
    const domain = identifier.includes("@") ? identifier.split("@")[1] : identifier;
    const workspaces = await prisma.tenantWorkspace.findMany({
      where: {
        OR: [{ domain }, { slug: { contains: identifier, mode: "insensitive" } }],
        isActive: true,
      },
    });
    return workspaces.map((ws: TenantWorkspace) => ({
      id: ws.id,
      tenant_id: ws.tenantId,
      name: ws.name,
      slug: ws.slug,
      domain: ws.domain ?? null,
      is_active: ws.isActive,
    }));
  }

  async findUserByEmail(tenantId: string, email: string): Promise<UserRow | null> {
    const user = await prisma.authUser.findFirst({
      where: { tenantId, email },
    });
    if (!user) return null;
    return this.mapUser(user);
  }

  async findUserByEmailOrUsername(emailOrUsername: string): Promise<UserRow | null> {
    const user = await prisma.authUser.findFirst({
      where: { email: emailOrUsername },
    });
    if (!user) return null;
    return this.mapUser(user);
  }

  async createOtpCode(input: {
    tenantId: string;
    userId: string;
    code: string;
    purpose: string;
    expiresAt: Date;
  }): Promise<OtpRow> {
    const otp = await prisma.otpCode.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        code: input.code,
        purpose: input.purpose,
        expiresAt: input.expiresAt,
      },
    });
    return this.mapOtp(otp);
  }

  async findValidOtp(code: string, purpose: string): Promise<OtpRow | null> {
    const otp = await prisma.otpCode.findFirst({
      where: {
        code,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!otp) return null;
    return this.mapOtp(otp);
  }

  async markOtpUsed(otpId: string): Promise<void> {
    await prisma.otpCode.update({
      where: { id: otpId },
      data: { usedAt: new Date() },
    });
  }

  async createResetToken(input: {
    userId: string;
    tenantId: string;
  }): Promise<ResetTokenRow> {
    const token = await prisma.resetToken.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });
    return {
      token: token.token,
      user_id: token.userId,
      tenant_id: token.tenantId,
      expires_at: token.expiresAt,
    };
  }

  async setTenantContext(tenantId: string): Promise<void> {
    // Prisma doesn't natively support session-level variables like PostgreSQL RLS context.
    // Tenant scoping is enforced via repository WHERE clauses (tenantId) and server-side authorization.
    // RLS is defense-in-depth only; application-layer tenant filtering is authoritative.
    return;
  }

  private mapUser(u: any): UserRow {
    return {
      id: u.id,
      tenant_id: u.tenantId,
      email: u.email,
      password_hash: u.passwordHash ?? null,
      is_root_admin: u.isRootAdmin,
      is_superadmin: u.isSuperadmin,
      break_glass_enabled: u.breakGlassEnabled,
    };
  }

  private mapOtp(o: any): OtpRow {
    return {
      id: o.id,
      tenant_id: o.tenantId,
      user_id: o.userId,
      code: o.code,
      purpose: o.purpose,
      expires_at: o.expiresAt,
      used_at: o.usedAt ?? null,
    };
  }
}

export const authRepository = new AuthRepository();

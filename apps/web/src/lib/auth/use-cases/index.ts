import { PrismaClient } from "@prisma/client";
import { comparePassword, generateOtp, sha256Hex } from "../crypto";
import { sendOtpEmail } from "../ses";

const prisma = new PrismaClient();

export async function loginUseCase(input: {
  domain: string;
  email: string;
  password: string;
  rememberMe?: boolean;
}) {
  const { domain, email, password } = input;

  const workspace = await prisma.tenantWorkspace.findFirst({
    where: { domain, isActive: true },
  });
  if (!workspace) {
    throw new Error("Invalid credentials");
  }

  const user = await prisma.authUser.findFirst({
    where: { tenantId: workspace.tenantId, email },
  });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (!user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    throw new Error("Invalid credentials");
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tenantId: user.tenantId,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return {
    sessionToken: session.token,
    tenantId: user.tenantId,
    userId: user.id,
    role: user.isSuperadmin ? ["superadmin"] : user.isRootAdmin ? ["root_admin"] : ["user"],
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function tenantSelectorUseCase(input: { identifier: string }) {
  const { identifier } = input;
  const domain = identifier.includes("@") ? identifier.split("@")[1] : identifier;

  const workspaces = await prisma.tenantWorkspace.findMany({
    where: {
      OR: [{ domain }, { slug: { contains: identifier, mode: "insensitive" } }],
      isActive: true,
    },
  });

  return {
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      domain: w.domain ?? null,
      isActive: w.isActive,
    })),
  };
}

export async function forgotPasswordUseCase(input: {
  emailOrUsername: string;
  purpose: string;
}) {
  const { emailOrUsername, purpose } = input;

  const user = await prisma.authUser.findFirst({
    where: { email: emailOrUsername },
  });

  if (!user) {
    return { codeSent: true, expiresInMinutes: 10, challengeId: null };
  }

  if (!user.isRootAdmin && !user.isSuperadmin) {
    return { codeSent: true, expiresInMinutes: 10, challengeId: null };
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const otp = await prisma.otpCode.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      code: sha256Hex(code),
      purpose,
      expiresAt,
    },
  });

  await sendOtpEmail({
    to: user.email,
    code,
    expiresInMinutes: 10,
  });

  return { codeSent: true, expiresInMinutes: 10, challengeId: otp.id };
}

export async function verifyOtpUseCase(input: {
  challengeId: string;
  code: string;
  purpose: string;
}) {
  const { challengeId, code, purpose } = input;

  if (!challengeId || !/^\d{6}$/.test(code)) {
    throw new Error("Invalid or expired code");
  }

  const otp = await prisma.otpCode.findFirst({
    where: {
      id: challengeId,
      code: sha256Hex(code),
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otp) {
    throw new Error("Invalid or expired code");
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });

  const resetToken = crypto.randomUUID();
  await prisma.resetToken.create({
    data: {
      token: resetToken,
      userId: otp.userId,
      tenantId: otp.tenantId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return { verified: true, resetToken };
}

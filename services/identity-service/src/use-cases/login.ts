import { LoginRequest, LoginResponse } from "@opsengine/api-contracts";
import { authRepository } from "../repositories/auth.repository";
import { comparePassword } from "../lib/crypto";
import { createSession, setSessionCookie } from "../lib/session";
import { sendOtpEmail } from "../lib/ses";

export async function loginUseCase(input: LoginRequest): Promise<LoginResponse> {
  const { domain, email, password } = input;

  // Resolve tenant from domain
  const workspace = await authRepository.findWorkspaceByDomain(domain);
  if (!workspace || !workspace.is_active) {
    throw new Error("Organization not found or inactive");
  }

  const tenantId = workspace.tenant_id;

  // Find user by email within tenant scope
  const user = await authRepository.findUserByEmail(tenantId, email);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  // Verify password (bcrypt)
  if (!user.password_hash || !(await comparePassword(password, user.password_hash))) {
    throw new Error("Invalid credentials");
  }

  // Create server-side session (database-backed, revocable)
  const session = await createSession({
    userId: user.id,
    tenantId: user.tenant_id,
    roles: user.is_superadmin ? ["superadmin"] : user.is_root_admin ? ["root_admin"] : ["user"],
  });

  await setSessionCookie(session);

  return {
    sessionToken: session.id,
    tenantId: user.tenant_id,
    userId: user.id,
    role: session.roles,
    expiresAt: session.expiresAt.toISOString(),
  };
}

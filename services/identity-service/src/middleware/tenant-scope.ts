import { authRepository } from "../repositories/auth.repository";

export async function tenantScopeMiddleware(tenantId: string) {
  // Set tenant context for RLS (PostgreSQL session variable)
  await authRepository.setTenantContext(tenantId);
}

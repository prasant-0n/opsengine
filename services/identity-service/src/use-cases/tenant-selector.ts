import { TenantSelectorRequest, TenantSelectorResponse } from "@opsengine/api-contracts";
import { authRepository } from "../repositories/auth.repository";

export async function tenantSelectorUseCase(input: TenantSelectorRequest): Promise<TenantSelectorResponse> {
  const { identifier } = input;

  // Resolve workspaces by email domain or workspace domain
  const workspaces = await authRepository.findWorkspacesByIdentifier(identifier);

  return {
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      domain: w.domain ?? null,
      isActive: w.is_active,
    })),
  };
}

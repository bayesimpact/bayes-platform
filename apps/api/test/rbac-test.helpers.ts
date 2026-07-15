import type { TestingModule } from "@nestjs/testing"
import { RbacService } from "@/domains/rbac/rbac.service"

let organizationRbacCatalogReady = false

/** Seeds org RBAC catalog once per test worker (roles are never cleared). */
export async function ensureOrganizationRbacCatalog(module: TestingModule): Promise<void> {
  if (organizationRbacCatalogReady) {
    return
  }

  await module.get(RbacService).seedOrganizationRolesAndPermissions()
  organizationRbacCatalogReady = true
}

import type { TestingModule } from "@nestjs/testing"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import { PLATFORM_STAFF_ROLE, PLATFORM_SUPERADMIN_ROLE } from "@/domains/rbac/rbac.constants"
import { RbacService } from "@/domains/rbac/rbac.service"
import type { User } from "@/domains/users/user.entity"

let rbacCatalogReady = false

/** Seeds the org + project + agent RBAC catalogs once per test worker (roles are never cleared). */
export async function ensureRbacCatalog(module: TestingModule): Promise<void> {
  if (rbacCatalogReady) {
    return
  }

  const rbacService = module.get(RbacService)
  await rbacService.seedOrganizationRolesAndPermissions()
  await rbacService.seedProjectRolesAndPermissions()
  await rbacService.seedAgentRolesAndPermissions()
  rbacCatalogReady = true
}

async function assignGlobalRoleToUser({
  repositories,
  user,
  roleKey,
}: {
  repositories: AllRepositories
  user: User
  roleKey: string
}): Promise<void> {
  const globalRole = await repositories.roleRepository.findOneOrFail({
    where: { key: roleKey },
  })

  await repositories.userMembershipRepository.save(
    userMembershipFactory.build({
      userId: user.id,
      resourceType: "global",
      resourceId: null,
      role: "member",
      roleId: globalRole.id,
    }),
  )
}

export async function assignPlatformStaffToUser(params: {
  repositories: AllRepositories
  user: User
}): Promise<void> {
  await assignGlobalRoleToUser({ ...params, roleKey: PLATFORM_STAFF_ROLE })
}

export async function assignPlatformSuperadminToUser(params: {
  repositories: AllRepositories
  user: User
}): Promise<void> {
  await assignGlobalRoleToUser({ ...params, roleKey: PLATFORM_SUPERADMIN_ROLE })
}

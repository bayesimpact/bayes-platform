import type { TestingModule } from "@nestjs/testing"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import { ORG_CREATOR_ROLE } from "@/domains/rbac/rbac.constants"
import { RbacService } from "@/domains/rbac/rbac.service"
import type { User } from "@/domains/users/user.entity"

let organizationRbacCatalogReady = false

/** Seeds org RBAC catalog once per test worker (roles are never cleared). */
export async function ensureOrganizationRbacCatalog(module: TestingModule): Promise<void> {
  if (organizationRbacCatalogReady) {
    return
  }

  await module.get(RbacService).seedOrganizationRolesAndPermissions()
  organizationRbacCatalogReady = true
}

export async function assignOrgCreatorToUser({
  repositories,
  user,
}: {
  repositories: AllRepositories
  user: User
}): Promise<void> {
  const orgCreatorRole = await repositories.roleRepository.findOneOrFail({
    where: { key: ORG_CREATOR_ROLE },
  })

  await repositories.userMembershipRepository.save(
    userMembershipFactory.build({
      userId: user.id,
      resourceType: "global",
      resourceId: null,
      role: "member",
      roleId: orgCreatorRole.id,
    }),
  )
}

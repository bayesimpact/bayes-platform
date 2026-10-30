import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { PROJECT_ROLES, REVIEW_CAMPAIGN_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"
import { MembershipsModule } from "./memberships.module"
import type { RoleGrantResourceType } from "./role-grant.entity"
import { roleGrantFactory } from "./role-grant.factory"

describe("role_grant", () => {
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MembershipsModule, OrganizationsModule, RbacModule],
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  const roleId = async (roleKey: string) =>
    (await repositories.roleRepository.findOneOrFail({ where: { key: roleKey } })).id

  const insertRow = async (params: {
    userId: string
    resourceType: RoleGrantResourceType
    resourceId: string | null
    roleKey: string
  }) =>
    repositories.roleGrantRepository.save(
      roleGrantFactory.build({
        userId: params.userId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        roleId: await roleId(params.roleKey),
      }),
    )

  describe("unique index on (user, resource type, resource, role)", () => {
    it("lets a person hold several roles on one project, redundant ones included", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const member = await repositories.userRepository.save(userFactory.build())

      for (const roleKey of Object.values(PROJECT_ROLES)) {
        await insertRow({
          userId: member.id,
          resourceType: "project",
          resourceId: project.id,
          roleKey,
        })
      }

      const rows = await repositories.roleGrantRepository.find({
        where: { userId: member.id, resourceType: "project", resourceId: project.id },
        relations: { rbacRole: true },
      })
      expect(rows.map((row) => row.rbacRole?.key).sort()).toEqual(
        Object.values(PROJECT_ROLES).sort(),
      )
    })

    it("refuses the same role twice for one person on one resource", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const member = await repositories.userRepository.save(userFactory.build())
      const row = {
        userId: member.id,
        resourceType: "project" as const,
        resourceId: project.id,
        roleKey: PROJECT_ROLES.admin,
      }
      await insertRow(row)

      await expect(insertRow(row)).rejects.toThrow(/UQ_role_grant_role/)
    })

    it("lets two people hold the same role, and one person the same role on two projects", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const { project: otherProject } = await createOrganizationWithProject(repositories)
      const first = await repositories.userRepository.save(userFactory.build())
      const second = await repositories.userRepository.save(userFactory.build())

      await insertRow({
        userId: first.id,
        resourceType: "project",
        resourceId: project.id,
        roleKey: PROJECT_ROLES.member,
      })
      await insertRow({
        userId: second.id,
        resourceType: "project",
        resourceId: project.id,
        roleKey: PROJECT_ROLES.member,
      })
      await insertRow({
        userId: first.id,
        resourceType: "project",
        resourceId: otherProject.id,
        roleKey: PROJECT_ROLES.member,
      })

      await expect(
        repositories.roleGrantRepository.count({ where: { resourceType: "project" } }),
      ).resolves.toBeGreaterThanOrEqual(3)
    })

    it("lets a person be tester and reviewer of one campaign, each once", async () => {
      const member = await repositories.userRepository.save(userFactory.build())
      const campaignId = "00000000-0000-4000-8000-000000000001"

      await insertRow({
        userId: member.id,
        resourceType: "review_campaign",
        resourceId: campaignId,
        roleKey: REVIEW_CAMPAIGN_ROLES.tester,
      })
      await insertRow({
        userId: member.id,
        resourceType: "review_campaign",
        resourceId: campaignId,
        roleKey: REVIEW_CAMPAIGN_ROLES.reviewer,
      })

      await expect(
        insertRow({
          userId: member.id,
          resourceType: "review_campaign",
          resourceId: campaignId,
          roleKey: REVIEW_CAMPAIGN_ROLES.tester,
        }),
      ).rejects.toThrow(/UQ_role_grant_role/)
    })
  })
})

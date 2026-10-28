import type { QueryRunner } from "typeorm"
import { type AllRepositories, buildAllRepositories } from "@/common/test/test-all-repositories"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  PROJECT_ROLES,
  REVIEW_CAMPAIGN_REPORT_READ_PERMISSION,
  REVIEW_CAMPAIGN_ROLE_PERMISSIONS,
  REVIEW_CAMPAIGN_ROLES,
} from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import type { User } from "@/domains/users/user.entity"
import { ReviewCampaignRoles1791800888000 } from "@/migrations/1791800888000-review-campaign-roles"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"

const CAMPAIGN_ROLE_KEYS = Object.values(REVIEW_CAMPAIGN_ROLES)

/**
 * Each case runs in a transaction rolled back at the end: the role table is never cleared between
 * specs, so the catalog the other specs rely on comes back untouched.
 */
describe("ReviewCampaignRoles1791800888000", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let queryRunner: QueryRunner
  let repositories: AllRepositories
  const migration = new ReviewCampaignRoles1791800888000()

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    await ensureRbacCatalog(setup.module)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    queryRunner = await setup.startTransaction()
    repositories = buildAllRepositories((entity) => queryRunner.manager.getRepository(entity))
    // The database as it was before the migration: no campaign roles, no report grant on projects.
    await queryRunner.query(
      `DELETE FROM role_permission AS role_permission
       USING role
       WHERE role_permission.role_id = role.id
         AND role.key IN ('project_owner', 'project_admin')
         AND role_permission.permission_key = $1`,
      [REVIEW_CAMPAIGN_REPORT_READ_PERMISSION],
    )
    await queryRunner.query(`DELETE FROM role WHERE key = ANY($1)`, [CAMPAIGN_ROLE_KEYS])
  })

  afterEach(async () => {
    await queryRunner.rollbackTransaction()
    await queryRunner.release()
  })

  // A campaign with its project, a second project of the same organization, and campaign rows
  // written by the previous invitation flow (legacy role, no role_id).
  const createCampaignContext = async () => {
    const { organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )

    const addOrganizationMember = async () =>
      (
        await addUserToOrganization({
          repositories,
          organization,
          membership: { roleKeys: ["org_member"] },
        })
      ).user

    const addLegacyCampaignRow = (user: User, role: ReviewCampaignMembershipRole) =>
      repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: user.id,
          resourceType: "review_campaign",
          resourceId: campaign.id,
          role,
          roleId: null,
        }),
      )

    return {
      organization,
      project,
      otherProject,
      campaign,
      addOrganizationMember,
      addLegacyCampaignRow,
    }
  }

  const findRoleId = async (roleKey: string): Promise<string> => {
    const [role] = await queryRunner.query(`SELECT id FROM role WHERE key = $1`, [roleKey])
    return role.id
  }

  const listGrantsByCampaignRole = async (): Promise<Record<string, string[]>> => {
    const rows: { roleKey: string; permissionKey: string }[] = await queryRunner.query(
      `SELECT role.key AS "roleKey", role_permission.permission_key AS "permissionKey"
       FROM role
       INNER JOIN role_permission ON role_permission.role_id = role.id
       WHERE role.key = ANY($1)`,
      [CAMPAIGN_ROLE_KEYS],
    )
    const grantsByRole: Record<string, string[]> = {}
    for (const row of rows) {
      grantsByRole[row.roleKey] = [...(grantsByRole[row.roleKey] ?? []), row.permissionKey].sort()
    }
    return grantsByRole
  }

  const listRoleKeysHoldingReport = async (): Promise<string[]> => {
    const rows: { roleKey: string }[] = await queryRunner.query(
      `SELECT role.key AS "roleKey"
       FROM role
       INNER JOIN role_permission ON role_permission.role_id = role.id
       WHERE role_permission.permission_key = $1`,
      [REVIEW_CAMPAIGN_REPORT_READ_PERMISSION],
    )
    return rows.map((row) => row.roleKey).sort()
  }

  const findRoleIdOfRow = async (membershipId: string): Promise<string | null> =>
    (await repositories.userMembershipRepository.findOneByOrFail({ id: membershipId })).roleId

  const snapshotCatalogAndMemberships = async () => ({
    roles: await queryRunner.query(`SELECT id, key, name, scope_type FROM role ORDER BY key`),
    rolePermissions: await queryRunner.query(
      `SELECT role_id, permission_key FROM role_permission ORDER BY role_id, permission_key`,
    ),
    memberships: await queryRunner.query(
      `SELECT id, resource_type, resource_id, role, role_id, deleted_at
       FROM user_membership ORDER BY id`,
    ),
  })

  describe("up", () => {
    it("creates both campaign roles with their grants", async () => {
      expect(await listGrantsByCampaignRole()).toEqual({})

      await migration.up(queryRunner)

      const roles: { key: string; scopeType: string }[] = await queryRunner.query(
        `SELECT key, scope_type AS "scopeType" FROM role WHERE key = ANY($1) ORDER BY key`,
        [CAMPAIGN_ROLE_KEYS],
      )
      expect(roles).toEqual(
        [...CAMPAIGN_ROLE_KEYS].sort().map((key) => ({ key, scopeType: "review_campaign" })),
      )
      expect(await listGrantsByCampaignRole()).toEqual(
        Object.fromEntries(
          Object.entries(REVIEW_CAMPAIGN_ROLE_PERMISSIONS).map(([roleKey, permissionKeys]) => [
            roleKey,
            [...permissionKeys].sort(),
          ]),
        ),
      )
    })

    it("gives the report to project owners and admins only, among project roles", async () => {
      expect(await listRoleKeysHoldingReport()).toEqual([])

      await migration.up(queryRunner)

      expect(await listRoleKeysHoldingReport()).toEqual(
        [PROJECT_ROLES.admin, PROJECT_ROLES.owner, REVIEW_CAMPAIGN_ROLES.reviewer].sort(),
      )
    })

    it("changes nothing when run a second time", async () => {
      const { project, addOrganizationMember, addLegacyCampaignRow } = await createCampaignContext()
      const projectMember = await addOrganizationMember()
      await addUserToProject({ repositories, project, user: projectMember })
      await addLegacyCampaignRow(projectMember, "tester")
      await addLegacyCampaignRow(await addOrganizationMember(), "reviewer")
      await migration.up(queryRunner)
      const afterFirstRun = await snapshotCatalogAndMemberships()

      await migration.up(queryRunner)

      expect(await snapshotCatalogAndMemberships()).toEqual(afterFirstRun)
    })

    it("sets the campaign role only for people who hold a live project row on the campaign's project", async () => {
      const { project, otherProject, addOrganizationMember, addLegacyCampaignRow } =
        await createCampaignContext()
      const projectMember = await addOrganizationMember()
      await addUserToProject({ repositories, project, user: projectMember })
      const projectMemberTesterRow = await addLegacyCampaignRow(projectMember, "tester")
      const projectMemberReviewerRow = await addLegacyCampaignRow(projectMember, "reviewer")

      const withoutProjectRow = await addOrganizationMember()
      const withoutProjectRowTesterRow = await addLegacyCampaignRow(withoutProjectRow, "tester")

      const removedFromProject = await addOrganizationMember()
      const { membership: removedProjectMembership } = await addUserToProject({
        repositories,
        project,
        user: removedFromProject,
      })
      await repositories.userMembershipRepository.softDelete({ id: removedProjectMembership.id })
      const removedFromProjectTesterRow = await addLegacyCampaignRow(removedFromProject, "tester")

      const onOtherProject = await addOrganizationMember()
      await addUserToProject({ repositories, project: otherProject, user: onOtherProject })
      const onOtherProjectReviewerRow = await addLegacyCampaignRow(onOtherProject, "reviewer")

      await migration.up(queryRunner)

      expect(await findRoleIdOfRow(projectMemberTesterRow.id)).toBe(
        await findRoleId(REVIEW_CAMPAIGN_ROLES.tester),
      )
      expect(await findRoleIdOfRow(projectMemberReviewerRow.id)).toBe(
        await findRoleId(REVIEW_CAMPAIGN_ROLES.reviewer),
      )
      expect(await findRoleIdOfRow(withoutProjectRowTesterRow.id)).toBeNull()
      expect(await findRoleIdOfRow(removedFromProjectTesterRow.id)).toBeNull()
      expect(await findRoleIdOfRow(onOtherProjectReviewerRow.id)).toBeNull()
    })

    it("deletes no project row", async () => {
      const { project, addOrganizationMember, addLegacyCampaignRow } = await createCampaignContext()
      const projectMember = await addOrganizationMember()
      await addUserToProject({ repositories, project, user: projectMember })
      await addLegacyCampaignRow(projectMember, "tester")
      const listProjectRowIds = async () =>
        (
          await repositories.userMembershipRepository.find({
            where: { resourceType: "project" },
            withDeleted: true,
          })
        )
          .map((projectRow) => projectRow.id)
          .sort()
      const projectRowIdsBefore = await listProjectRowIds()

      await migration.up(queryRunner)

      expect(await listProjectRowIds()).toEqual(projectRowIdsBefore)
    })
  })

  describe("down", () => {
    it("gives a project member row to participants without one, then removes the campaign roles", async () => {
      const { project, campaign, addOrganizationMember, addLegacyCampaignRow } =
        await createCampaignContext()
      const projectMember = await addOrganizationMember()
      const { membership: projectMembership } = await addUserToProject({
        repositories,
        project,
        user: projectMember,
      })
      await addLegacyCampaignRow(projectMember, "tester")
      await migration.up(queryRunner)

      // Accepted through the new invitation flow: a campaign row with its role, no project row.
      const campaignOnlyTester = await addOrganizationMember()
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId: campaignOnlyTester.id,
          resourceType: "review_campaign",
          resourceId: campaign.id,
          role: "tester",
          roleId: await findRoleId(REVIEW_CAMPAIGN_ROLES.tester),
        }),
      )

      await migration.down(queryRunner)

      const projectRowOf = (user: User) =>
        repositories.userMembershipRepository.find({
          where: { userId: user.id, resourceType: "project", resourceId: project.id },
        })
      const [givenProjectRow, ...extraProjectRows] = await projectRowOf(campaignOnlyTester)
      expect(extraProjectRows).toEqual([])
      expect(givenProjectRow?.role).toBe("member")
      expect(givenProjectRow?.roleId).toBe(await findRoleId(PROJECT_ROLES.member))
      expect((await projectRowOf(projectMember)).map((projectRow) => projectRow.id)).toEqual([
        projectMembership.id,
      ])

      const campaignRows = await repositories.userMembershipRepository.find({
        where: { resourceType: "review_campaign" },
      })
      expect(campaignRows).toHaveLength(2)
      expect(campaignRows.map((campaignRow) => campaignRow.roleId)).toEqual([null, null])

      const remainingCampaignRoles = await queryRunner.query(
        `SELECT key FROM role WHERE key = ANY($1)`,
        [CAMPAIGN_ROLE_KEYS],
      )
      expect(remainingCampaignRoles).toEqual([])
      expect(await listGrantsByCampaignRole()).toEqual({})
      expect(await listRoleKeysHoldingReport()).toEqual([])
    })
  })
})

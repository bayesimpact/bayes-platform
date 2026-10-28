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
import { REVIEW_CAMPAIGN_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import type { User } from "@/domains/users/user.entity"
import { ReviewCampaignRolesBackfill1792143739000 } from "@/migrations/1792143739000-review-campaign-roles-backfill"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"

// Each case runs in a transaction rolled back at the end, as in review-campaign-roles.migration.spec.
describe("ReviewCampaignRolesBackfill1792143739000", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let queryRunner: QueryRunner
  let repositories: AllRepositories
  const migration = new ReviewCampaignRolesBackfill1792143739000()

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
  })

  afterEach(async () => {
    await queryRunner.rollbackTransaction()
    await queryRunner.release()
  })

  // A campaign, a second project of its organization, and campaign rows written by a pod running
  // the previous invitation flow (legacy role, no role_id).
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

    return { project, otherProject, addOrganizationMember, addLegacyCampaignRow }
  }

  const findRoleId = async (roleKey: string): Promise<string> => {
    const [role] = await queryRunner.query(`SELECT id FROM role WHERE key = $1`, [roleKey])
    return role.id
  }

  const findRoleIdOfRow = async (membershipId: string): Promise<string | null> =>
    (await repositories.userMembershipRepository.findOneByOrFail({ id: membershipId })).roleId

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

  it("changes nothing when run a second time", async () => {
    const { project, addOrganizationMember, addLegacyCampaignRow } = await createCampaignContext()
    const projectMember = await addOrganizationMember()
    await addUserToProject({ repositories, project, user: projectMember })
    await addLegacyCampaignRow(projectMember, "tester")
    await addLegacyCampaignRow(await addOrganizationMember(), "reviewer")
    const listMemberships = () =>
      queryRunner.query(
        `SELECT id, resource_type, resource_id, role, role_id, deleted_at
         FROM user_membership ORDER BY id`,
      )
    await migration.up(queryRunner)
    const afterFirstRun = await listMemberships()

    await migration.up(queryRunner)

    expect(await listMemberships()).toEqual(afterFirstRun)
  })
})

import { randomUUID } from "node:crypto"
import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addMemberByEmailToProject } from "@/domains/projects/memberships/project-membership.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { reviewCampaignFactory } from "../review-campaign.factory"
import { ReviewCampaignsModule } from "../review-campaigns.module"

describe("ReviewCampaigns - addMemberRole", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let reviewCampaignId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A campaign of a project the caller owns, and a member of that project. */
  const createContext = async (status: "active" | "closed" = "active") => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      (status === "active" ? reviewCampaignFactory.active() : reviewCampaignFactory.closed())
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const { addedUser: member } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "member@example.com", authSubject: "oidc|member" },
      projectMembership: { roleKeys: ["project_member"] },
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { owner: user, member }
  }

  const subject = (userId: string, roleKey: string) =>
    request({
      route: ReviewCampaignsRoutes.addMemberRole,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId, userId }),
      token: "token",
      request: { payload: { roleKey } },
    })

  const roleKeysOf = async (userId: string) => {
    const rows = await repositories.userMembershipRepository.find({
      where: { userId, resourceType: "review_campaign", resourceId: reviewCampaignId },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  it("gives a member of the project the tester and reviewer roles, without an invitation", async () => {
    const { member } = await createContext()

    expectResponse(await subject(member.id, "review_campaign_tester"), 201)
    expectResponse(await subject(member.id, "review_campaign_reviewer"), 201)

    expect(await roleKeysOf(member.id)).toEqual([
      "review_campaign_reviewer",
      "review_campaign_tester",
    ])
    expect(await repositories.invitationRepository.count()).toBe(0)
  })

  it("refuses a closed campaign", async () => {
    const { member } = await createContext("closed")

    expectResponse(
      await subject(member.id, "review_campaign_tester"),
      403,
      "Cannot add roles to a closed campaign",
    )
  })

  it("refuses a role that is not a campaign role", async () => {
    const { member } = await createContext()

    expectResponse(
      await subject(member.id, "project_admin"),
      400,
      "Not a review campaign role: project_admin",
    )
  })

  it("refuses the caller's own roles and someone outside the project", async () => {
    const { owner } = await createContext()

    expectResponse(
      await subject(owner.id, "review_campaign_tester"),
      403,
      "Cannot change your own role",
    )
    expectResponse(await subject(randomUUID(), "review_campaign_tester"), 404)
  })

  it("doesn't let a project member give campaign roles", async () => {
    const { member } = await createContext()
    authSubject = member.authSubject!

    expectResponse(
      await subject(randomUUID(), "review_campaign_tester"),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
  })
})

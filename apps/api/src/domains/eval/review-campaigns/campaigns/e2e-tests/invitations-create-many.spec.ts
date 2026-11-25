import { randomUUID } from "node:crypto"
import {
  type CreateCampaignInvitationsInputDto,
  EvalCampaignInvitationsRoutes,
} from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { findReviewCampaignMembershipRow } from "../../../../../../test/membership-test.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation campaign invitations - createMany", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createCampaign = async (status: "active" | "draft") => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      (status === "active" ? reviewCampaignFactory.active() : reviewCampaignFactory.draft())
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, campaign }
  }

  const subject = (payload: CreateCampaignInvitationsInputDto) =>
    request({
      route: EvalCampaignInvitationsRoutes.createMany,
      pathParams: { organizationId, projectId, reviewCampaignId },
      body: { payload },
      token: "token",
    })

  it("stores the requested campaign role, without giving access yet", async () => {
    const { campaign } = await createCampaign("active")

    const response = await subject({
      emails: ["reviewer@example.com"],
      role: "reviewer",
      language: "en",
    })

    expectSchemaResponse(EvalCampaignInvitationsRoutes.createMany, response, 201)
    expect(response.body.data.invitations).toEqual([
      {
        id: expect.any(String),
        invitedEmail: "reviewer@example.com",
        role: "reviewer",
        status: "pending",
        invitedAt: expect.any(Number),
      },
    ])
    expect(typeof response.body.data.emailSent).toBe("boolean")
    const invitedUser = await repositories.userRepository.findOneByOrFail({
      email: "reviewer@example.com",
    })
    expect(
      await findReviewCampaignMembershipRow(repositories, {
        userId: invitedUser.id,
        campaignId: campaign.id,
        roleKey: "review_campaign_reviewer",
      }),
    ).toBeNull()
    await expectActivityCreated("invitation.invite", { organizationId, projectId })
  })

  it("skips someone who already holds the campaign role", async () => {
    const { organization, project, campaign } = await createCampaign("active")
    const participant = await repositories.userRepository.save(
      userFactory.build({ email: "participant@example.com" }),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_tester")
        .transient({ organization, project, campaign, user: participant })
        .build(),
    })

    const response = await subject({
      emails: ["participant@example.com"],
      role: "tester",
      language: "fr",
    })

    expectSchemaResponse(EvalCampaignInvitationsRoutes.createMany, response, 201)
    expect(response.body.data.invitations).toEqual([])
  })

  it("refuses to invite members to a campaign that is not active", async () => {
    await createCampaign("draft")
    expectResponse(
      await subject({ emails: ["tester@example.com"], role: "tester", language: "en" }),
      409,
    )
  })

  it("answers 400 for a role that is not a campaign role", async () => {
    await createCampaign("active")
    expectResponse(
      await request({
        route: EvalCampaignInvitationsRoutes.createMany,
        pathParams: { organizationId, projectId, reviewCampaignId },
        body: { payload: { emails: ["tester@example.com"], role: "owner", language: "en" } },
        token: "token",
      }),
      400,
    )
  })

  it("answers 400 for an empty list of emails, which the old handler took", async () => {
    await createCampaign("active")
    expectResponse(await subject({ emails: [], role: "tester", language: "en" }), 400)
  })

  it("answers 400 without a language, which the old handler took", async () => {
    await createCampaign("active")
    expectResponse(
      await request({
        route: EvalCampaignInvitationsRoutes.createMany,
        pathParams: { organizationId, projectId, reviewCampaignId },
        body: { payload: { emails: ["tester@example.com"], role: "tester" } },
        token: "token",
      }),
      400,
    )
    expect(await repositories.invitationRepository.count()).toBe(0)
  })
})

import { randomUUID } from "node:crypto"
import { EvalReviewCampaignsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation review campaigns - getOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

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

  const subject = () =>
    request({
      route: EvalReviewCampaignsRoutes.getOne,
      pathParams: { organizationId, projectId, reviewCampaignId },
      token: "token",
    })

  it("returns the campaign with its memberships", async () => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "Detail" }),
    )
    const membership = await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_tester")
        .transient({ organization, project, campaign, user })
        .build(),
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getOne, response)
    expect(response.body.data).toMatchObject({
      id: campaign.id,
      name: "Detail",
      status: "draft",
      aggregates: null,
    })
    expect(response.body.data.memberships).toEqual([
      {
        userId: user.id,
        userEmail: user.email,
        userHasSignedIn: true,
        roles: [{ membershipId: membership.id, key: "review_campaign_tester" }],
      },
    ])
  })

  it("returns a campaign with every optional field set", async () => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .closed()
        .transient({ organization, project, agent, agentSettings })
        .build({
          name: "Helpful Assistant review",
          description: "How the Helpful Assistant answers",
          testerPerSessionQuestions: [
            {
              id: "tp-1",
              prompt: "Pick a tag",
              type: "single-choice",
              required: true,
              options: ["Product", "Pricing", "Support"],
              isFactual: true,
            },
          ],
          testerEndOfPhaseQuestions: [
            { id: "te-1", prompt: "Overall impression?", type: "rating", required: false },
          ],
          reviewerQuestions: [
            { id: "rv-1", prompt: "Any issues?", type: "free-text", required: false },
          ],
        }),
    )
    const testerMembership = await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_tester")
        .transient({ organization, project, campaign, user })
        .build(),
    })
    const reviewerMembership = await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_reviewer")
        .transient({ organization, project, campaign, user })
        .build(),
    })
    const invitedUser = await repositories.userRepository.save(
      userFactory.build({ authSubject: null }),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_reviewer")
        .transient({ organization, project, campaign, user: invitedUser })
        .build(),
    })
    const session = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .build({ campaignId: campaign.id }),
    )
    await repositories.testerSessionFeedbackRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      agentType: "conversation",
      overallRating: 4,
      comment: null,
      answers: [],
    })
    await repositories.testerCampaignSurveyRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      userId: user.id,
      overallRating: 5,
      comment: null,
      answers: [],
      submittedAt: new Date(),
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getOne, response)
    expect(response.body.data).toMatchObject({
      description: "How the Helpful Assistant answers",
      status: "closed",
      testerPerSessionQuestions: campaign.testerPerSessionQuestions,
      testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions,
      reviewerQuestions: campaign.reviewerQuestions,
      aggregates: { meanTesterRating: 4, surveyCount: 1, sessionCount: 1 },
    })
    expect(response.body.data.memberships).toHaveLength(2)
    expect(response.body.data.memberships).toEqual(
      expect.arrayContaining([
        {
          userId: user.id,
          userEmail: user.email,
          userHasSignedIn: true,
          roles: expect.arrayContaining([
            { membershipId: testerMembership.id, key: "review_campaign_tester" },
            { membershipId: reviewerMembership.id, key: "review_campaign_reviewer" },
          ]),
        },
        expect.objectContaining({ userId: invitedUser.id, userHasSignedIn: false }),
      ]),
    )
  })

  it("gives no aggregates while the campaign is active, and computes them once it is closed", async () => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const scope = {
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
    }
    for (const overallRating of [4, 5]) {
      const session = await repositories.conversationAgentSessionRepository.save(
        conversationAgentSessionFactory
          .transient({ organization, project, agent, user })
          .build({ campaignId: campaign.id }),
      )
      await repositories.testerSessionFeedbackRepository.save({
        ...scope,
        sessionId: session.id,
        agentType: "conversation",
        overallRating,
        comment: null,
        answers: [],
      })
    }
    await repositories.testerCampaignSurveyRepository.save({
      ...scope,
      userId: user.id,
      overallRating: 5,
      comment: null,
      answers: [],
      submittedAt: new Date(),
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    const activeResponse = await subject()
    expectSchemaResponse(EvalReviewCampaignsRoutes.getOne, activeResponse)
    expect(activeResponse.body.data.aggregates).toBeNull()

    await repositories.reviewCampaignRepository.update(campaign.id, {
      status: "closed",
      closedAt: new Date(),
    })

    const closedResponse = await subject()
    expectSchemaResponse(EvalReviewCampaignsRoutes.getOne, closedResponse)
    expect(closedResponse.body.data.aggregates).toStrictEqual({
      meanTesterRating: 4.5,
      surveyCount: 1,
      sessionCount: 2,
    })
  })

  it("gives zeroed aggregates for a closed campaign that nobody tested", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .closed()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getOne, response)
    expect(response.body.data.aggregates).toStrictEqual({
      meanTesterRating: null,
      surveyCount: 0,
      sessionCount: 0,
    })
  })
})

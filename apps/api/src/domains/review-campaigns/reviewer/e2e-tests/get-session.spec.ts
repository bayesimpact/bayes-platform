import { randomUUID } from "node:crypto"
import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { formAgentSessionFactory } from "@/domains/agents/form-agent-sessions/form-agent-session.factory"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { reviewCampaignMembershipFactory } from "../../memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "../../review-campaign.factory"
import { ReviewCampaignsModule } from "../../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-reviewer-get" }),
}

describe("ReviewCampaigns - Reviewer session detail (blind redaction)", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let sessionId: string = randomUUID()
  let accessToken: string = "token"
  let auth0Id = `auth0|reviewer-${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(INVITATION_SENDER)
          .useValue(mockInvitationSender),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = `auth0|reviewer-${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds a campaign with:
   *   - a tester per-session question flagged `isFactual` (rating type)
   *   - a tester per-session question NOT flagged factual (free-text)
   *   - a reviewer question
   *   - a tester user with a submitted feedback including opinion + factual answers
   *   - a conversation session stamped with the campaign + 2 messages
   *   - the caller as reviewer
   */
  const seedCampaignAndSession = async ({
    campaignStatus = "active" as "active" | "closed",
  } = {}) => {
    const {
      organization,
      project,
      user: reviewer,
    } = await createOrganizationWithProject(repositories, { user: { auth0Id } })
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-view-${randomUUID()}@example.com` }),
    )
    const agent = agentFactory.transient({ organization, project }).build({ type: "conversation" })
    await repositories.agentRepository.save(agent)

    const factory =
      campaignStatus === "closed" ? reviewCampaignFactory.closed() : reviewCampaignFactory.active()
    const campaign = factory.transient({ organization, project, agent }).build({
      testerPerSessionQuestions: [
        {
          id: "q-factual",
          prompt: "Did the agent escalate to a human?",
          type: "single-choice",
          required: true,
          options: ["Yes", "No"],
          isFactual: true,
        },
        {
          id: "q-opinion-text",
          prompt: "Anything else?",
          type: "free-text",
          required: false,
        },
        {
          id: "q-opinion-rating",
          prompt: "Was it helpful?",
          type: "rating",
          required: true,
          // isFactual omitted → treated as opinion
        },
      ],
    })
    await repositories.reviewCampaignRepository.save(campaign)
    await repositories.reviewCampaignMembershipRepository.save(
      reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign, user: reviewer })
        .build(),
    )
    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session)
    await repositories.agentMessageRepository.save([
      {
        organizationId: organization.id,
        projectId: project.id,
        sessionId: session.id,
        role: "user",
        content: "hello",
      },
      {
        organizationId: organization.id,
        projectId: project.id,
        sessionId: session.id,
        role: "assistant",
        content: "hi",
      },
      {
        organizationId: organization.id,
        projectId: project.id,
        sessionId: session.id,
        role: "tool",
        content: '{"result": "internal"}',
      },
    ])
    await repositories.testerSessionFeedbackRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      sessionType: "conversation",
      overallRating: 2,
      comment: "not great",
      answers: [
        { questionId: "q-factual", value: "Yes" },
        { questionId: "q-opinion-text", value: "more context needed" },
        { questionId: "q-opinion-rating", value: 2 },
      ],
    })

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    sessionId = session.id

    return { organization, project, agent, campaign, reviewer, tester, session }
  }

  const subject = async () =>
    request({
      route: ReviewCampaignsRoutes.getReviewerSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId, sessionId }),
      token: accessToken,
    })

  it("returns a blind payload when the caller has not yet submitted a review", async () => {
    const { agent, tester, session } = await seedCampaignAndSession()

    const response = await subject()
    expectResponse(response, 200)
    const data = response.body.data as Record<string, unknown>
    expect(data.blind).toBe(true)
    expect(data.sessionId).toBe(session.id)
    expect(data.testerUserId).toBe(tester.id)
    expect(data.agent).toMatchObject({ id: agent.id, name: agent.name, type: "conversation" })
    expect(data.transcript).toHaveLength(2)
    // Opinion/hidden fields must be absent in blind mode
    expect(data.testerFeedback).toBeUndefined()
    expect(data.myReview).toBeUndefined()
    expect(data.otherReviews).toBeUndefined()
    // Only the factual answer (rating/single-choice + isFactual) survives
    expect(data.factualTesterAnswers).toEqual([{ questionId: "q-factual", value: "Yes" }])
    // otherReviewerCount is 0 because no one has reviewed yet
    expect(data.otherReviewerCount).toBe(0)
  })

  it("counts other reviewers but omits their content in blind mode", async () => {
    const { organization, project, campaign, session } = await seedCampaignAndSession()
    const otherReviewer = await repositories.userRepository.save(
      userFactory.build({ email: `other-reviewer-${randomUUID()}@example.com` }),
    )
    await repositories.reviewCampaignMembershipRepository.save(
      reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign, user: otherReviewer })
        .build(),
    )
    await repositories.reviewerSessionReviewRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      sessionType: "conversation",
      reviewerUserId: otherReviewer.id,
      overallRating: 4,
      comment: "their hidden comment",
      answers: [],
      submittedAt: new Date(),
    })

    const response = await subject()
    expectResponse(response, 200)
    const data = response.body.data as Record<string, unknown>
    expect(data.blind).toBe(true)
    expect(data.otherReviewerCount).toBe(1)
    expect(data.otherReviews).toBeUndefined()
  })

  it("switches to the full payload once the caller submits their review", async () => {
    await seedCampaignAndSession()

    const submit = await request({
      route: ReviewCampaignsRoutes.submitReviewerSessionReview,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId, sessionId }),
      token: accessToken,
      request: { payload: { overallRating: 5, comment: "mine", answers: [] } },
    })
    expectResponse(submit, 201)

    const response = await subject()
    expectResponse(response, 200)
    const data = response.body.data as Record<string, unknown> & {
      testerFeedback: { answers: unknown[] }
    }
    expect(data.blind).toBe(false)
    expect(data.myReview).toMatchObject({ overallRating: 5, comment: "mine" })
    expect(data.testerFeedback).toMatchObject({
      overallRating: 2,
      comment: "not great",
    })
    // Full payload exposes all tester answers, not just factual ones
    expect(data.testerFeedback.answers).toHaveLength(3)
    expect(data.otherReviews).toEqual([])
    // `factualTesterAnswers` only exists on the blind variant
    expect(data.factualTesterAnswers).toBeUndefined()
  })

  it("never returns free-text answers during blind, even if isFactual is true", async () => {
    // Re-seed with a free-text question flagged isFactual (should still be hidden).
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-text-${randomUUID()}@example.com` }),
    )
    const agent = agentFactory.transient({ organization, project }).build({ type: "conversation" })
    await repositories.agentRepository.save(agent)
    const campaign = reviewCampaignFactory
      .active()
      .transient({ organization, project, agent })
      .build({
        testerPerSessionQuestions: [
          {
            id: "q-factual-text",
            prompt: "What was escalated?",
            type: "free-text",
            required: false,
            // isFactual: true, but free-text is always opinion per spec
            isFactual: true,
          },
        ],
      })
    await repositories.reviewCampaignRepository.save(campaign)
    await repositories.reviewCampaignMembershipRepository.save(
      reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({
          organization,
          project,
          campaign,
          user: await repositories.userRepository.findOneByOrFail({ auth0Id }),
        })
        .build(),
    )
    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session)
    await repositories.testerSessionFeedbackRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      sessionType: "conversation",
      overallRating: 3,
      comment: null,
      answers: [{ questionId: "q-factual-text", value: "tool calls" }],
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    sessionId = session.id

    const response = await subject()
    expectResponse(response, 200)
    const data = response.body.data as Record<string, unknown>
    expect(data.blind).toBe(true)
    expect(data.factualTesterAnswers).toEqual([])
  })

  it("still serves the blind payload on a closed campaign (reviewers keep read access)", async () => {
    await seedCampaignAndSession({ campaignStatus: "closed" })

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.blind).toBe(true)
  })

  it("includes formResult for form-agent sessions (schema from agent, value from session)", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-form-${randomUUID()}@example.com` }),
    )
    const formAgent = agentFactory.transient({ organization, project }).build({
      type: "form",
      outputJsonSchema: {
        type: "object",
        properties: {
          fullName: { type: "string", title: "Full name" },
          email: { type: "string", title: "Email" },
        },
      },
    })
    await repositories.agentRepository.save(formAgent)
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.active().transient({ organization, project, agent: formAgent }).build(),
    )
    const callerUser = await repositories.userRepository.findOneByOrFail({ auth0Id })
    await repositories.reviewCampaignMembershipRepository.save(
      reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign, user: callerUser })
        .build(),
    )
    const session = formAgentSessionFactory
      .transient({ organization, project, agent: formAgent, user: tester })
      .build({
        campaignId: campaign.id,
        result: { fullName: "Jane Doe", email: "jane@example.com" },
      })
    await repositories.formAgentSessionRepository.save(session)

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    sessionId = session.id

    const response = await subject()
    expectResponse(response, 200)
    const data = response.body.data as {
      sessionType: string
      formResult: { schema: Record<string, unknown>; value: Record<string, unknown> | null }
    }
    expect(data.sessionType).toBe("form")
    expect(data.formResult.schema).toMatchObject({
      type: "object",
      properties: { fullName: { title: "Full name" } },
    })
    expect(data.formResult.value).toEqual({
      fullName: "Jane Doe",
      email: "jane@example.com",
    })
  })

  it("returns formResult: null for conversation sessions", async () => {
    await seedCampaignAndSession()
    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.formResult).toBeNull()
  })
})

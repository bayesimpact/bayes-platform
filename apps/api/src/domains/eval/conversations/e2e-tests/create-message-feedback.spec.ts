import { randomUUID } from "node:crypto"
import { EvalConversationsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation conversations - createMessageFeedback", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentMessageId: string
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

  /** A reply of the agent in a tester's session of an active campaign. */
  const createContext = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agent: { type: "conversation" } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    const { user } = await addUserToReviewCampaign({
      repositories,
      organization,
      project,
      campaign,
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    const agentSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .reviewCampaignTester()
        .build({ campaignId: campaign.id }),
    )
    const agentMessage = await repositories.agentMessageRepository.save(
      agentMessageFactory
        .assistant()
        .transient({ organization, project, session: agentSession, agentSettings })
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    agentMessageId = agentMessage.id
    return { user }
  }

  const subject = async (payload: unknown) =>
    request({
      route: EvalConversationsRoutes.createMessageFeedback,
      pathParams: { organizationId, projectId, agentMessageId },
      token: "token",
      body: { payload },
    })

  const findSavedFeedback = () =>
    repositories.agentMessageFeedbackRepository.findOneByOrFail({ agentMessageId })

  const countFeedbacks = () => repositories.agentMessageFeedbackRepository.count()

  it("saves a thumbs-up with no text", async () => {
    const { user } = await createContext()

    const response = await subject({ rating: "positive" })

    expectSchemaResponse(EvalConversationsRoutes.createMessageFeedback, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(await findSavedFeedback()).toMatchObject({
      userId: user.id,
      rating: "positive",
      content: "",
    })
  })

  it("saves a report with its trimmed text", async () => {
    await createContext()

    const response = await subject({ rating: "negative", content: "  Out of date prices  " })

    expectSchemaResponse(EvalConversationsRoutes.createMessageFeedback, response, 201)
    expect(await findSavedFeedback()).toMatchObject({
      rating: "negative",
      content: "Out of date prices",
    })
  })

  it("answers 400 for a report with no text", async () => {
    await createContext()

    expectResponse(await subject({ rating: "negative", content: "   " }), 400)
    expect(await countFeedbacks()).toBe(0)
  })

  // The old route saves a feedback with no rating as a report. The schema requires one.
  it("answers 400 for a feedback with no rating", async () => {
    await createContext()

    expectResponse(await subject({ content: "Persisted feedback" }), 400)
    expect(await countFeedbacks()).toBe(0)
  })

  it("answers 400 for an unknown rating", async () => {
    await createContext()

    expectResponse(await subject({ rating: "neutral", content: "Persisted feedback" }), 400)
    expect(await countFeedbacks()).toBe(0)
  })
})

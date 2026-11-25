import { randomUUID } from "node:crypto"
import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"
import { EvalConversationsRoutes, type ReplyStreamEventDto } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import { In } from "typeorm"
import { parseSseDataEvents } from "@/common/test/sse.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageAttachmentDocumentFactory } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { reviewCampaignStatusErrorMessage } from "@/domains/review-campaigns/review-campaign-status"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { EvalModule } from "../../eval.module"

describe("Evaluation conversations - streamReply", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let accessToken: string | undefined = "token"
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
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A tester's session in an active campaign, which runs the version in production. */
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
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    return { organization, project, agent, agentSettings, campaign, user }
  }

  type Context = Awaited<ReturnType<typeof createContext>>

  const conversationParams = () => ({ organizationId, projectId, agentId, agentSessionId })

  const send = (path: string, body: object) => {
    const pending = supertest(app.getHttpServer()).post(path).send(body).set("Connection", "close")
    if (accessToken) pending.set("Authorization", `Bearer ${accessToken}`)
    return pending
  }

  /** The stream is a POST: the message travels in the body. */
  const subject = (body: object) =>
    send(EvalConversationsRoutes.streamReply.getPath(conversationParams()), body)

  /** The route this one copies, which the app still serves. */
  const subjectOnTheOldRoute = (body: object) =>
    send(
      AgentSessionMessagesRoutes.review_campaign_tester.stream.getPath(conversationParams()),
      body,
    )

  const countMessages = () =>
    repositories.agentMessageRepository.count({ where: { sessionId: agentSessionId } })

  const findAssistantMessageSettingsId = async () => {
    const [reply] = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSessionId, role: "assistant" },
    })
    return reply?.agentSettingsId
  }

  /** Points the path at a live session of the caller, in the campaign or in none. */
  const useLiveSessionOfCaller = async (
    { organization, project, agent, user, campaign }: Context,
    { inCampaign }: { inCampaign: boolean },
  ) => {
    const agentSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .live()
        .build({ campaignId: inCampaign ? campaign.id : null }),
    )
    agentSessionId = agentSession.id
  }

  it("streams the reply and stores both messages", async () => {
    await createContext()

    const response = await subject({ payload: { content: "Hello" } })

    expect(response.status).toBe(200)
    const events = parseSseDataEvents<ReplyStreamEventDto>(response.text)
    expect(events.map((event) => event.type)).toContain("start")
    expect(events.map((event) => event.type)).toContain("end")
    const fullText = events.map((event) => (event.type === "chunk" ? event.content : "")).join("")
    expect(fullText).toBe("Hello, I'm the stream default mock value!")
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSessionId, role: In(["user", "assistant"]) },
      order: { createdAt: "ASC" },
    })
    expect(messages.map((message) => [message.role, message.content])).toEqual([
      ["user", "Hello"],
      ["assistant", "Hello, I'm the stream default mock value!"],
    ])
  })

  it("attaches the uploaded document to the message the tester typed", async () => {
    const { organization, project } = await createContext()
    const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.save(
      agentMessageAttachmentDocumentFactory.transient({ organization, project }).build(),
    )

    const response = await subject({
      payload: { content: "Hello", attachmentDocumentId: attachmentDocument.id },
    })

    expect(response.status).toBe(200)
    expect(response.text).not.toContain("event: error")
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSessionId, role: In(["user", "assistant"]) },
      order: { createdAt: "ASC" },
    })
    expect(messages.map((message) => [message.role, message.attachmentDocumentId ?? null])).toEqual(
      [
        ["user", attachmentDocument.id],
        ["assistant", null],
      ],
    )
  })

  it("runs its campaign's version, which starts as the published one, even when a draft exists", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, isDraft: true }),
    )

    const response = await subject({ payload: { content: "Hello" } })

    expect(response.text).not.toContain("event: error")
    expect(await findAssistantMessageSettingsId()).toBe(agentSettings.id)
  })

  it("runs the version its campaign chose, not the one in production", async () => {
    const { organization, project, agent, campaign } = await createContext()
    const campaignVersion = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent }).build({ revision: 2 }),
    )
    await repositories.reviewCampaignRepository.update(
      { id: campaign.id },
      { agentSettingsId: campaignVersion.id },
    )

    const response = await subject({ payload: { content: "Hello" } })

    expect(response.text).not.toContain("event: error")
    expect(await findAssistantMessageSettingsId()).toBe(campaignVersion.id)
  })

  // The old route answers 200 with an SSE error frame for these: the schema now refuses them
  // with a 400 before the stream starts.
  it.each([
    ["an empty message", { content: "" }],
    ["a message of spaces only", { content: "   " }],
    [
      "a settings version, which only the playground chooses",
      { content: "Hello", agentSettingsRevision: 2 },
    ],
    [
      "an attachment id that is not a UUID",
      { content: "Hello", attachmentDocumentId: "not-a-uuid" },
    ],
  ])("answers 400 for %s", async (_case, payload) => {
    await createContext()

    expectResponse(await subject({ payload }), 400)
    expect(await countMessages()).toBe(0)
  })

  it("answers 400 for a body with no payload", async () => {
    await createContext()

    expectResponse(await subject({}), 400)
  })

  it("answers 401 without a token", async () => {
    await createContext()
    accessToken = undefined

    expectResponse(await subject({ payload: { content: "Hello" } }), 401)
  })

  it("does not read a message sent in the URL", async () => {
    // A message in the URL can exceed a proxy's limit and is copied to every access log.
    await createContext()

    const response = await supertest(app.getHttpServer())
      .get(EvalConversationsRoutes.streamReply.getPath(conversationParams()))
      .query({ q: JSON.stringify({ payload: { content: "Hello" } }) })
      .set("Connection", "close")
      .set("Authorization", "Bearer token")

    expect(response.status).toBe(404)
    expect(await countMessages()).toBe(0)
  })

  // The handler checks the campaign, as the route it copies does: the status is read from that
  // route, so the copy cannot drift from it.
  it("answers as today for a reply on a closed campaign", async () => {
    const { campaign } = await createContext()
    await repositories.reviewCampaignRepository.update(
      { id: campaign.id },
      { status: "closed", closedAt: new Date() },
    )

    const oldResponse = await subjectOnTheOldRoute({ payload: { content: "Hello" } })
    const response = await subject({ payload: { content: "Hello" } })

    expect(response.status).toBe(oldResponse.status)
    expect(oldResponse.text).toContain(reviewCampaignStatusErrorMessage("closed"))
    expect(response.text).toContain(reviewCampaignStatusErrorMessage("closed"))
    expect(await countMessages()).toBe(0)
  })

  it("answers 404 for a live session", async () => {
    const context = await createContext()
    await useLiveSessionOfCaller(context, { inCampaign: false })

    expectResponse(await subjectOnTheOldRoute({ payload: { content: "Hello" } }), 404)
    expectResponse(await subject({ payload: { content: "Hello" } }), 404)
    expect(await countMessages()).toBe(0)
  })

  // A live session of the campaign passes the guards: the handler turns it away, as the route it
  // copies does.
  it("answers as today for a live session of the campaign", async () => {
    const context = await createContext()
    await useLiveSessionOfCaller(context, { inCampaign: true })

    const oldResponse = await subjectOnTheOldRoute({ payload: { content: "Hello" } })
    const response = await subject({ payload: { content: "Hello" } })

    expect(response.status).toBe(oldResponse.status)
    expect(oldResponse.text).toContain("event: error")
    expect(response.text).toContain("event: error")
    expect(response.text).toContain("data: Not Found")
    expect(await countMessages()).toBe(0)
  })
})

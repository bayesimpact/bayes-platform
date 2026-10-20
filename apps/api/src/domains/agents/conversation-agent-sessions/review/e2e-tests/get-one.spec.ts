import { randomUUID } from "node:crypto"
import { ConversationReviewRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { agentEmbedConfigFactory } from "@/domains/public-chat/agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "@/domains/public-chat/public-agent-sessions/public-agent-session.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { grantConversationReview } from "../../../conversation-reviewers/agent-conversation-reviewer.factory"
import { conversationAgentSessionFactory } from "../../conversation-agent-session.factory"
import { ConversationAgentSessionsModule } from "../../conversation-agent-sessions.module"

describe("ConversationReviewRoutes.getOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule, ActivitiesModule],
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

  /** A conversation of the project owner, read by a reviewer who is a plain organization member. */
  const createContext = async ({ type }: { type: "live" | "playground" } = { type: "live" }) => {
    const context = await createOrganizationWithAgentSession({
      repositories,
      agentType: "conversation",
      params: { agentSession: { type, title: "Pricing question" } },
    })
    const { organization, project, agent, agentSession, agentSettings } = context
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id

    const firstMessage = agentMessageFactory
      .transient({ organization, project, session: agentSession, agentSettings })
      .user()
      .build({ content: "What does the plan cost?", createdAt: new Date("2026-01-01T10:00:00Z") })
    const secondMessage = agentMessageFactory
      .transient({ organization, project, session: agentSession, agentSettings })
      .assistant()
      .build({
        content: "The plan costs 10 per month.",
        status: "completed",
        toolCalls: [{ id: "call-1", name: "lookup_knowledge_base", arguments: {} }],
        createdAt: new Date("2026-01-01T10:00:05Z"),
      })
    await repositories.agentMessageRepository.save([secondMessage, firstMessage])

    const { user: reviewer } = await addUserToOrganization({
      repositories,
      organization,
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    await grantConversationReview({ repositories, user: reviewer, agent })

    return { ...context, firstMessage, secondMessage }
  }

  const subject = async () =>
    request({
      route: ConversationReviewRoutes.getOne,
      pathParams: { organizationId, projectId, agentId, agentSessionId },
      token: "token",
    })

  it("returns another user's conversation with its messages, oldest first", async () => {
    const { agentSession, firstMessage, secondMessage } = await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual({
      sessionId: agentSession.id,
      agentId,
      kind: "conversation",
      type: "live",
      title: "Pricing question",
      isSubSession: false,
      isPurged: false,
      createdAt: agentSession.createdAt.getTime(),
      updatedAt: expect.any(Number),
      messages: [
        {
          id: firstMessage.id,
          role: "user",
          content: "What does the plan cost?",
          toolNames: [],
          createdAt: firstMessage.createdAt.getTime(),
        },
        {
          id: secondMessage.id,
          role: "assistant",
          content: "The plan costs 10 per month.",
          status: "completed",
          toolNames: ["lookup_knowledge_base"],
          createdAt: secondMessage.createdAt.getTime(),
        },
      ],
    })
  })

  it("returns playground conversations too", async () => {
    await createContext({ type: "playground" })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.type).toBe("playground")
  })

  /** A public (embed) session of the same agent, with one visitor message. */
  const createPublicSession = async (
    context: Awaited<ReturnType<typeof createContext>>,
    params: { externalVisitorId?: string | null; purgedAt?: Date | null } = {},
  ) => {
    const { organization, project, agent, agentSession, agentSettings } = context
    const embedConfig = agentEmbedConfigFactory.transient({ organization, project, agent }).build()
    await repositories.agentEmbedConfigRepository.save(embedConfig)
    const publicSession = publicAgentSessionFactory.transient({ embedConfig }).build({
      title: "Opening hours",
      externalVisitorId: params.externalVisitorId ?? null,
      purgedAt: params.purgedAt ?? null,
    })
    await repositories.publicAgentSessionRepository.save(publicSession)

    // Public messages share the message table, keyed by the public session id.
    const visitorMessage = {
      ...agentMessageFactory
        .transient({ organization, project, session: agentSession, agentSettings })
        .user()
        .build({ content: "When are you open?", createdAt: new Date("2026-01-02T09:00:00Z") }),
      sessionId: publicSession.id,
    }
    await repositories.agentMessageRepository.save(visitorMessage)
    agentSessionId = publicSession.id
    return { publicSession, visitorMessage }
  }

  it("returns a public session with its visitor id and messages", async () => {
    const context = await createContext()
    const { publicSession, visitorMessage } = await createPublicSession(context, {
      externalVisitorId: "visitor-42",
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual({
      sessionId: publicSession.id,
      agentId,
      kind: "public",
      channel: "embed",
      externalVisitorId: "visitor-42",
      title: "Opening hours",
      isSubSession: false,
      isPurged: false,
      createdAt: publicSession.createdAt.getTime(),
      updatedAt: expect.any(Number),
      messages: [
        {
          id: visitorMessage.id,
          role: "user",
          content: "When are you open?",
          toolNames: [],
          createdAt: visitorMessage.createdAt.getTime(),
        },
      ],
    })
  })

  it("marks a public session purged by retention, without a visitor id", async () => {
    const context = await createContext()
    await createPublicSession(context, { purgedAt: new Date("2026-02-01T00:00:00Z") })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.kind).toBe("public")
    expect(response.body.data.isPurged).toBe(true)
    expect(response.body.data.externalVisitorId).toBeUndefined()
  })

  it("returns 404 for a public session of another agent of the same project", async () => {
    const context = await createContext()
    const otherAgent = agentFactory
      .transient({ organization: context.organization, project: context.project })
      .build()
    await repositories.agentRepository.save(otherAgent)
    await createPublicSession({ ...context, agent: otherAgent })

    expectResponse(await subject(), 404)
  })

  it("returns an extraction session with its document, status and result", async () => {
    const context = await createOrganizationWithAgentSession({
      repositories,
      agentType: "extraction",
      params: {
        document: { title: "report.pdf" },
        agentSession: { type: "live", status: "success", result: { title: "Quarterly report" } },
      },
    })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentSessionId = context.agentSession.id
    const { user: reviewer } = await addUserToOrganization({
      repositories,
      organization: context.organization,
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    await grantConversationReview({ repositories, user: reviewer, agent: context.agent })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual({
      sessionId: context.agentSession.id,
      agentId,
      kind: "extraction",
      type: "live",
      extraction: {
        status: "success",
        documentTitle: "report.pdf",
        result: { title: "Quarterly report" },
      },
      isSubSession: false,
      isPurged: false,
      createdAt: context.agentSession.createdAt.getTime(),
      updatedAt: expect.any(Number),
      messages: [],
    })
  })

  it("returns 404 for a session of another agent of the same project", async () => {
    const { organization, project, user } = await createContext()
    const otherAgent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(otherAgent)
    const otherSession = conversationAgentSessionFactory
      .transient({ organization, project, agent: otherAgent, user })
      .live()
      .build()
    await repositories.conversationAgentSessionRepository.save(otherSession)
    agentSessionId = otherSession.id

    expectResponse(await subject(), 404)
  })

  it("returns 404 for an unknown session id", async () => {
    await createContext()
    agentSessionId = randomUUID()

    expectResponse(await subject(), 404)
  })

  it("returns 400 for a session id that is not a uuid", async () => {
    await createContext()
    agentSessionId = "not-a-uuid"

    expectResponse(await subject(), 400)
  })

  it("records the read in the activity journal with the session it opened", async () => {
    await createContext()

    expectResponse(await subject(), 200)

    const activities = await setup.dataSource.query(
      `SELECT action, entity_id AS "entityId", entity_type AS "entityType" FROM activity`,
    )
    expect(activities).toEqual([
      { action: "agent.conversation.review", entityId: agentSessionId, entityType: "agentSession" },
    ])
  })
})

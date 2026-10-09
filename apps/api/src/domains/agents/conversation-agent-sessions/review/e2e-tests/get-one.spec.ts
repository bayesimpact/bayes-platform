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
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import {
  assignConversationReviewerToUser,
  ensureRbacCatalog,
} from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
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
    await assignConversationReviewerToUser({ repositories, user: reviewer })

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

import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { createChitChatConversation } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { conversationFormFactory } from "@/domains/agents/shared/conversation-forms/conversation-form.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk conversations - deleteOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const context = await createOrganizationWithAgentSession({
      repositories,
      agentType: "conversation",
      params: { agentSession: { type: "live" } },
    })
    const { organization, project, user, agent, agentSettings, agentSession } = context
    await createChitChatConversation(organization, project, agentSession, agentSettings, {
      agentMessageRepository: repositories.agentMessageRepository,
    })
    await repositories.conversationFormRepository.save(
      conversationFormFactory
        .transient({ organization, project, agent, agentSettings, session: agentSession })
        .build({ state: { firstName: "Ada" } }),
    )
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    authSubject = user.authSubject!
    return context
  }

  const subject = async () =>
    request({
      route: DeskConversationsRoutes.deleteOne,
      pathParams: { organizationId, projectId, agentId, agentSessionId },
      token: "token",
    })

  it("deletes the conversation with its messages and forms", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskConversationsRoutes.deleteOne, response, 201)
    expect(response.body.data).toStrictEqual({ success: true })
    expect(
      await repositories.conversationAgentSessionRepository.count({
        where: { id: agentSessionId },
      }),
    ).toBe(0)
    expect(
      await repositories.agentMessageRepository.count({ where: { sessionId: agentSessionId } }),
    ).toBe(0)
    expect(
      await repositories.conversationFormRepository.count({ where: { sessionId: agentSessionId } }),
    ).toBe(0)
  })

  it("keeps the caller's other conversations", async () => {
    const { organization, project, user, agent } = await createContext()
    const otherSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .live()
        .build(),
    )

    expectSchemaResponse(DeskConversationsRoutes.deleteOne, await subject(), 201)

    expect(
      await repositories.conversationAgentSessionRepository.count({
        where: { id: otherSession.id },
      }),
    ).toBe(1)
  })
})

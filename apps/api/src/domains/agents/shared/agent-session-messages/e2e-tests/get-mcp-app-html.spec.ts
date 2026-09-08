import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { type Requester, testRequester } from "../../../../../../test/request"
import { agentMessageFactory, createChitChatConversation } from "../agent-messages.factory"
import { McpAppHtmlService } from "../mcp-app-html.service"

const resourceUri = "ui://pdf-export/mcp-app.html"

describe("AgentSessionMessagesRoutes.getMcpAppHtml", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  const readLiveHtml = jest.fn()

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  const accessToken = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(McpAppHtmlService)
          .useValue({ readLiveHtml }),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    readLiveHtml.mockReset()
    readLiveHtml.mockResolvedValue(new Map())
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, user, project, agent, agentSettings, agentSession } =
      await createOrganizationWithAgentSession({ repositories, agentType: "conversation" })

    await createChitChatConversation(organization, project, agentSession, agentSettings, {
      agentMessageRepository: repositories.agentMessageRepository,
    })

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    auth0Id = user.auth0Id

    return { organization, user, project, agent, agentSettings, agentSession }
  }

  const listMessages = async () =>
    request({
      route: AgentSessionMessagesRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })

  const subject = async () =>
    request({
      route: AgentSessionMessagesRoutes.getMcpAppHtml,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })

  it("returns the message list without reading any MCP server", async () => {
    await createContext()

    const response = await listMessages()

    expect(response.status).toBe(201)
    expect(response.body.data).toHaveLength(2)
    expect(readLiveHtml).not.toHaveBeenCalled()
  })

  it("returns the current HTML of each card the session points at", async () => {
    const { organization, project, agentSettings, agentSession, agent } = await createContext()
    const mcpServerId = "11111111-1111-4111-8111-111111111111"
    const reply = agentMessageFactory
      .assistant()
      .transient({ organization, project, session: agentSession, agentSettings })
      .build({
        content: "",
        toolCalls: [
          {
            id: "call-1",
            name: "export_pdf",
            arguments: {},
            result: { content: [{ type: "text", text: "Exported" }] },
            mcpApp: { mcpServerId, resourceUri },
          },
        ],
      })
    await repositories.agentMessageRepository.save(reply)
    readLiveHtml.mockResolvedValue(
      new Map([[`${mcpServerId}::${resourceUri}`, "<html>card</html>"]]),
    )

    const response = await subject()

    expect(response.status).toBe(201)
    expect(response.body.data).toEqual([{ mcpServerId, resourceUri, html: "<html>card</html>" }])
    expect(readLiveHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: agent.id,
        sessionId: agentSession.id,
        messages: expect.arrayContaining([expect.objectContaining({ id: reply.id })]),
      }),
    )
  })

  it("returns an empty list when the session has no MCP App card", async () => {
    await createContext()

    const response = await subject()

    expect(response.status).toBe(201)
    expect(response.body.data).toEqual([])
  })
})

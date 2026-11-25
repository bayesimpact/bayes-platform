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
import {
  agentMessageFactory,
  createChitChatConversation,
} from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { McpAppHtmlService } from "@/domains/agents/shared/agent-session-messages/mcp-app-html.service"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

const resourceUri = "ui://pdf-export/mcp-app.html"

describe("Evaluation conversations - getMcpAppsHtml", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  const readLiveHtml = jest.fn()

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(McpAppHtmlService)
          .useValue({ readLiveHtml }),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    readLiveHtml.mockReset()
    readLiveHtml.mockResolvedValue(new Map())
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A tester's session in an active campaign, with a short exchange. */
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
    await createChitChatConversation(organization, project, agentSession, agentSettings, {
      agentMessageRepository: repositories.agentMessageRepository,
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    return { organization, project, agent, agentSettings, agentSession }
  }

  const conversationParams = () => ({ organizationId, projectId, agentId, agentSessionId })

  const subject = async () =>
    request({
      route: EvalConversationsRoutes.getMcpAppsHtml,
      pathParams: conversationParams(),
      token: "token",
    })

  it("returns the messages without reading any MCP server", async () => {
    await createContext()

    const response = await request({
      route: EvalConversationsRoutes.getMessages,
      pathParams: conversationParams(),
      token: "token",
    })

    expectSchemaResponse(EvalConversationsRoutes.getMessages, response, 201)
    expect(response.body.data).toHaveLength(2)
    expect(readLiveHtml).not.toHaveBeenCalled()
  })

  it("returns the current HTML of each card the session points at", async () => {
    const { organization, project, agent, agentSettings, agentSession } = await createContext()
    const mcpServerId = randomUUID()
    const reply = await repositories.agentMessageRepository.save(
      agentMessageFactory
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
        }),
    )
    readLiveHtml.mockResolvedValue(
      new Map([
        [
          `${mcpServerId}::${resourceUri}`,
          { html: "<html>card</html>", csp: { resourceDomains: ["https://cdn.example.com"] } },
        ],
      ]),
    )

    const response = await subject()

    expectSchemaResponse(EvalConversationsRoutes.getMcpAppsHtml, response, 201)
    expect(response.body.data).toStrictEqual([
      {
        mcpServerId,
        resourceUri,
        html: "<html>card</html>",
        csp: { resourceDomains: ["https://cdn.example.com"] },
      },
    ])
    expect(readLiveHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: agent.id,
        sessionId: agentSession.id,
        messages: expect.arrayContaining([expect.objectContaining({ id: reply.id })]),
      }),
    )
  })

  it("leaves out the policy of an app that declares no domain", async () => {
    await createContext()
    const mcpServerId = randomUUID()
    readLiveHtml.mockResolvedValue(
      new Map([[`${mcpServerId}::${resourceUri}`, { html: "<html>card</html>" }]]),
    )

    const response = await subject()

    expectSchemaResponse(EvalConversationsRoutes.getMcpAppsHtml, response, 201)
    expect(response.body.data).toStrictEqual([
      { mcpServerId, resourceUri, html: "<html>card</html>" },
    ])
  })

  it("returns an empty list when the session shows no MCP App", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(EvalConversationsRoutes.getMcpAppsHtml, response, 201)
    expect(response.body.data).toEqual([])
  })
})

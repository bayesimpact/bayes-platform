import { randomUUID } from "node:crypto"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { McpAppHtmlService } from "@/domains/agents/shared/agent-session-messages/mcp-app-html.service"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { agentEmbedConfigFactory } from "../agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "../public-agent-sessions/public-agent-session.factory"
import { PublicChatModule } from "../public-chat.module"

const resourceUri = "ui://pdf-export/mcp-app.html"

describe("PublicChat - getMcpAppHtml", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  const readLiveHtml = jest.fn()

  let embedToken: string
  let sessionId: string
  let sessionToken: string

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [PublicChatModule],
      applyOverrides: (moduleBuilder) =>
        moduleBuilder.overrideProvider(McpAppHtmlService).useValue({ readLiveHtml }),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    readLiveHtml.mockReset()
    readLiveHtml.mockResolvedValue(new Map())
    embedToken = randomUUID()
    sessionId = randomUUID()
    sessionToken = randomUUID()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    const embedConfig = agentEmbedConfigFactory
      .transient({ organization, project, agent })
      .build({ isEnabled: true })
    await repositories.agentEmbedConfigRepository.save(embedConfig)

    const knownToken = randomUUID()
    const session = publicAgentSessionFactory
      .transient({ embedConfig, sessionToken: knownToken })
      .build()
    await repositories.publicAgentSessionRepository.save(session)

    embedToken = embedConfig.embedToken
    sessionId = session.id
    sessionToken = knownToken

    return { organization, project, agent, agentSettings, embedConfig, session }
  }

  const saveReplyWithCard = async (
    context: Awaited<ReturnType<typeof createContext>>,
    mcpServerId: string,
  ) => {
    await repositories.agentMessageRepository.save({
      id: randomUUID(),
      sessionId,
      organizationId: context.embedConfig.organizationId,
      projectId: context.embedConfig.projectId,
      agentSettingsId: context.agentSettings.id,
      role: "assistant" as const,
      content: "",
      status: "completed" as const,
      startedAt: new Date("2026-01-01T10:00:01Z"),
      completedAt: new Date("2026-01-01T10:00:02Z"),
      toolCalls: [
        {
          id: "call-1",
          name: "export_pdf",
          arguments: {},
          result: { content: [{ type: "text", text: "Exported" }] },
          mcpApp: { mcpServerId, resourceUri },
        },
      ],
      documentId: null,
      attachmentDocumentId: null,
      createdAt: new Date("2026-01-01T10:00:01Z"),
      updatedAt: new Date("2026-01-01T10:00:02Z"),
      deletedAt: null,
    })
  }

  const getSession = () =>
    request(app.getHttpServer())
      .get(`/public/agents/${embedToken}/sessions/${sessionId}`)
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

  const subject = () =>
    request(app.getHttpServer())
      .get(`/public/agents/${embedToken}/sessions/${sessionId}/mcp-app-html`)
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

  it("returns the session without reading any MCP server", async () => {
    const context = await createContext()
    await saveReplyWithCard(context, randomUUID())

    const response = await getSession()

    expect(response.status).toBe(200)
    expect(response.body.data.messages).toHaveLength(1)
    expect(readLiveHtml).not.toHaveBeenCalled()
  })

  it("returns the current HTML of each card the session points at", async () => {
    const context = await createContext()
    const mcpServerId = randomUUID()
    await saveReplyWithCard(context, mcpServerId)
    readLiveHtml.mockResolvedValue(
      new Map([[`${mcpServerId}::${resourceUri}`, "<html>card</html>"]]),
    )

    const response = await subject()

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([{ mcpServerId, resourceUri, html: "<html>card</html>" }])
    expect(readLiveHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: context.agent.id,
        sessionId,
        externalVisitorId: context.session.externalVisitorId,
      }),
    )
  })
})

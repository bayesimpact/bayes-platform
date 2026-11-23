import { randomUUID } from "node:crypto"
import { DeskConversationsRoutes, TOOL_NAMES } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageAttachmentDocumentFactory } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.factory"
import {
  agentMessageFactory,
  createChitChatConversation,
} from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk conversations - getMessages", () => {
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
    const { organization, project, user, agent, agentSession } = context
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    authSubject = user.authSubject!
    return context
  }

  const subject = async () =>
    request({
      route: DeskConversationsRoutes.getMessages,
      pathParams: { organizationId, projectId, agentId, agentSessionId },
      token: "token",
    })

  it("returns the messages of the conversation, oldest first", async () => {
    const { organization, project, agentSession, agentSettings } = await createContext()
    await createChitChatConversation(organization, project, agentSession, agentSettings, {
      agentMessageRepository: repositories.agentMessageRepository,
    })

    const response = await subject()

    expectSchemaResponse(DeskConversationsRoutes.getMessages, response, 201)
    expect(
      response.body.data.map((message) => ({ role: message.role, content: message.content })),
    ).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi!" },
    ])
  })

  it("returns a message with tool parts, a form, an attachment and sources", async () => {
    const { organization, project, agent, agentSession, agentSettings } = await createContext()
    // A newer version answered: the revision and the agent of each message stay out of the contract.
    const secondRevision = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent }).build({ revision: 2 }),
    )
    const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.save(
      agentMessageAttachmentDocumentFactory.transient({ organization, project }).build(),
    )
    const askedAt = new Date("2024-01-01T10:00:00.000Z")
    const answeredAt = new Date("2024-01-01T10:00:05.000Z")
    const documentId = randomUUID()
    const mcpServerId = randomUUID()
    const [question, reply] = await repositories.agentMessageRepository.save([
      agentMessageFactory
        .user()
        .transient({ organization, project, session: agentSession, agentSettings })
        .build({
          content: "Here is my form",
          status: "completed",
          createdAt: askedAt,
          attachmentDocumentId: attachmentDocument.id,
        }),
      agentMessageFactory
        .assistant()
        .transient({
          organization,
          project,
          session: agentSession,
          agentSettings: secondRevision,
        })
        .build({
          content: "I filled your form in.",
          status: "completed",
          createdAt: answeredAt,
          startedAt: askedAt,
          completedAt: answeredAt,
          toolCalls: [
            {
              id: "call-fill-form",
              name: TOOL_NAMES.fillForm,
              arguments: { formFields: { firstName: "Ada" } },
            },
            {
              id: "call-sources",
              name: TOOL_NAMES.sources,
              arguments: {
                sources: [
                  {
                    documentId,
                    documentTitle: "Pricing",
                    chunks: [{ chunkId: "chunk-1", partialContent: "Plans start at" }],
                  },
                ],
              },
            },
            {
              id: "call-export",
              name: "export_pdf",
              arguments: {},
              result: { content: [{ type: "text", text: "Exported" }] },
              mcpApp: { mcpServerId, resourceUri: "ui://pdf-export/mcp-app.html" },
            },
          ],
        }),
    ])
    if (!question || !reply) throw new Error("messages not saved")

    const response = await subject()

    expectSchemaResponse(DeskConversationsRoutes.getMessages, response, 201)
    expect(response.body.data).toStrictEqual([
      {
        id: question.id,
        role: "user",
        content: "Here is my form",
        status: "completed",
        createdAt: askedAt.getTime(),
        attachmentDocumentId: attachmentDocument.id,
      },
      {
        id: reply.id,
        role: "assistant",
        content: "I filled your form in.",
        status: "completed",
        createdAt: answeredAt.getTime(),
        toolCalls: [
          {
            id: "call-fill-form",
            name: "fillForm",
            arguments: { formFields: { firstName: "Ada" } },
          },
          {
            id: "call-sources",
            name: "sources",
            arguments: {
              sources: [
                {
                  documentId,
                  documentTitle: "Pricing",
                  chunks: [{ chunkId: "chunk-1", partialContent: "Plans start at" }],
                },
              ],
            },
          },
          {
            id: "call-export",
            name: "export_pdf",
            arguments: {},
            result: { content: [{ type: "text", text: "Exported" }] },
            mcpApp: { mcpServerId, resourceUri: "ui://pdf-export/mcp-app.html" },
          },
        ],
      },
    ])
  })

  it("settles a reply whose stream died with the server", async () => {
    const { organization, project, agentSession, agentSettings } = await createContext()
    const deadReply = await repositories.agentMessageRepository.save(
      agentMessageFactory
        .assistant()
        .streaming()
        .sentMinutesAgo(60)
        .transient({ organization, project, session: agentSession, agentSettings })
        .build({ content: "Half a" }),
    )

    const response = await subject()

    expectSchemaResponse(DeskConversationsRoutes.getMessages, response, 201)
    const [listed] = response.body.data
    expect(listed?.id).toBe(deadReply.id)
    expect(listed?.status).not.toBe("streaming")
  })

  it("returns an empty list for a conversation with no message", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskConversationsRoutes.getMessages, response, 201)
    expect(response.body.data).toEqual([])
  })
})

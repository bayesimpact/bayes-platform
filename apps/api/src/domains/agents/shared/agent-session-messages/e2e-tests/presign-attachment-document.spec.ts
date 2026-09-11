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
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"

describe("AgentSessionMessagesRoutes.presignAttachmentDocument", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, user, project, agent, agentSession } =
      await createOrganizationWithAgentSession({ repositories, agentType: "conversation" })

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    auth0Id = user.auth0Id

    return { organization, project }
  }

  const subject = async (
    payload: typeof AgentSessionMessagesRoutes.presignAttachmentDocument.request.payload,
  ) =>
    request({
      route: AgentSessionMessagesRoutes.presignAttachmentDocument,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
      request: { payload },
    })

  const getTemporaryUrlSubject = async (attachmentDocumentId: string) =>
    request({
      route: AgentSessionMessagesRoutes.getAttachmentDocumentTemporaryUrl,
      pathParams: removeNullish({
        organizationId,
        projectId,
        agentId,
        agentSessionId,
        attachmentDocumentId,
      }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })

  it("should create an attachment document and return a signed upload URL", async () => {
    const { organization, project } = await createContext()

    const response = await subject({
      type: "live",
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: 1234,
    })

    expectResponse(response, 201)
    expect(response.body.data.attachmentDocumentId).toBeDefined()
    expect(response.body.data.uploadUrl).toContain("/api/local-presign-upload/")

    const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.findOne({
      where: { id: response.body.data.attachmentDocumentId },
    })
    expect(attachmentDocument).not.toBeNull()
    expect(attachmentDocument?.organizationId).toBe(organization.id)
    expect(attachmentDocument?.projectId).toBe(project.id)
    expect(attachmentDocument?.fileName).toBe("support-notes.pdf")
    expect(attachmentDocument?.mimeType).toBe("application/pdf")
    expect(attachmentDocument?.size).toBe(1234)
    expect(attachmentDocument?.storageRelativePath).toBe(
      `${organization.id}/${project.id}/${response.body.data.attachmentDocumentId}.pdf`,
    )
  })

  it("should return a temporary URL for an attachment document", async () => {
    await createContext()
    const presignResponse = await subject({
      type: "live",
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: 1234,
    })

    const response = await getTemporaryUrlSubject(presignResponse.body.data.attachmentDocumentId)

    expectResponse(response, 201)
    expect(response.body.data.url).toContain("/documents/")
  })

  it("should reject unsupported attachment document MIME types", async () => {
    await createContext()

    const response = await subject({
      type: "live",
      fileName: "notes.txt",
      // @ts-expect-error Testing runtime validation for an unsupported MIME type.
      mimeType: "text/plain",
      size: 1234,
    })

    expectResponse(
      response,
      422,
      "Invalid file type: text/plain. Allowed types: PDF, PNG, or JPEG.",
    )
  })
})

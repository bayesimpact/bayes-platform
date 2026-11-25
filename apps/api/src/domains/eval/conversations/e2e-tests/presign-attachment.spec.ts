import { randomUUID } from "node:crypto"
import { ATTACHMENT_MAX_BYTES, EvalConversationsRoutes } from "@caseai-connect/eval-contracts"
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

describe("Evaluation conversations - presignAttachment and getAttachmentUrl", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
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

  /** A tester's session in an active campaign. */
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
    return { organization, project, agent, agentSettings, campaign, user, agentSession }
  }

  type Context = Awaited<ReturnType<typeof createContext>>

  const subject = async (payload: unknown) =>
    request({
      route: EvalConversationsRoutes.presignAttachment,
      pathParams: { organizationId, projectId, agentId, agentSessionId },
      token: "token",
      body: { payload },
    })

  const getAttachmentUrl = async (attachmentDocumentId: string) =>
    request({
      route: EvalConversationsRoutes.getAttachmentUrl,
      pathParams: { organizationId, projectId, agentId, agentSessionId, attachmentDocumentId },
      token: "token",
    })

  const presignAttachment = async (): Promise<string> => {
    const response = await subject({
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: 1234,
    })
    return response.body.data.attachmentDocumentId
  }

  /** Puts the attachment on a new message of a session, as sending the turn does. */
  const sendMessageWithAttachment = async ({
    context,
    session,
    attachmentDocumentId,
  }: {
    context: Context
    session: Context["agentSession"]
    attachmentDocumentId: string
  }) => {
    const { organization, project, agentSettings } = context
    await repositories.agentMessageRepository.save(
      agentMessageFactory
        .user()
        .transient({ organization, project, session, agentSettings })
        .build({ attachmentDocumentId }),
    )
  }

  const countAttachmentDocuments = () =>
    repositories.agentMessageAttachmentDocumentRepository.count()

  it("creates an attachment document and returns a signed upload URL", async () => {
    const { organization, project } = await createContext()

    const response = await subject({
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: 1234,
    })

    expectSchemaResponse(EvalConversationsRoutes.presignAttachment, response, 201)
    // The schema checks that `uploadUrl` is a URL: its shape depends on the storage backend.
    const { attachmentDocumentId } = response.body.data
    const attachmentDocument =
      await repositories.agentMessageAttachmentDocumentRepository.findOneByOrFail({
        id: attachmentDocumentId,
      })
    expect(attachmentDocument).toMatchObject({
      organizationId: organization.id,
      projectId: project.id,
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: 1234,
      storageRelativePath: `${organization.id}/${project.id}/${attachmentDocumentId}.pdf`,
    })
  })

  it("accepts a file of the largest size", async () => {
    await createContext()

    const response = await subject({
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: ATTACHMENT_MAX_BYTES,
    })

    expectSchemaResponse(EvalConversationsRoutes.presignAttachment, response, 201)
  })

  // The schema refuses these before any URL is signed: 400, where the tester route answers 422
  // for a type it refuses and for an empty name.
  it.each([
    ["an unsupported MIME type", { fileName: "notes.txt", mimeType: "text/plain", size: 1234 }],
    ["an empty file name", { fileName: "", mimeType: "application/pdf", size: 1234 }],
    [
      "a file above the largest size",
      { fileName: "notes.pdf", mimeType: "application/pdf", size: ATTACHMENT_MAX_BYTES + 1 },
    ],
    ["a size of 0", { fileName: "notes.pdf", mimeType: "application/pdf", size: 0 }],
    [
      "a size that is not an integer",
      { fileName: "notes.pdf", mimeType: "application/pdf", size: 12.5 },
    ],
  ])("answers 400 for %s without signing a URL", async (_case, payload) => {
    await createContext()

    expectResponse(await subject(payload), 400)
    expect(await countAttachmentDocuments()).toBe(0)
  })

  // The schema only refuses an empty name. A blank one passes it, and the handler answers 422,
  // as the tester route does.
  it("answers 422 for a blank file name without signing a URL", async () => {
    await createContext()

    expectResponse(
      await subject({ fileName: "   ", mimeType: "application/pdf", size: 1234 }),
      422,
      "File name is required.",
    )
    expect(await countAttachmentDocuments()).toBe(0)
  })

  it("returns a temporary URL for the attachment of a message of the session", async () => {
    const context = await createContext()
    const { organization, project } = context
    const attachmentDocumentId = await presignAttachment()
    await sendMessageWithAttachment({
      context,
      session: context.agentSession,
      attachmentDocumentId,
    })

    const response = await getAttachmentUrl(attachmentDocumentId)

    expectSchemaResponse(EvalConversationsRoutes.getAttachmentUrl, response, 201)
    // Both storage backends put the file's path in the URL.
    expect(response.body.data.url).toContain(
      `${organization.id}/${project.id}/${attachmentDocumentId}.pdf`,
    )
  })

  it("answers 404 for an attachment no message of the session carries", async () => {
    await createContext()
    const attachmentDocumentId = await presignAttachment()

    expectResponse(
      await getAttachmentUrl(attachmentDocumentId),
      404,
      "Attachment document not found",
    )
  })

  it("answers 404 for the attachment of another session of the campaign", async () => {
    const context = await createContext()
    const { organization, project, user, agent, campaign } = context
    const attachmentDocumentId = await presignAttachment()
    const otherSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, user, agent })
        .reviewCampaignTester()
        .build({ campaignId: campaign.id }),
    )
    await sendMessageWithAttachment({ context, session: otherSession, attachmentDocumentId })

    expectResponse(
      await getAttachmentUrl(attachmentDocumentId),
      404,
      "Attachment document not found",
    )
  })
})

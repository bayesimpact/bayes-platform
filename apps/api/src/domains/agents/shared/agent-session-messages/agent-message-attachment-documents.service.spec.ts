import { afterAll } from "@jest/globals"
import { NotFoundException } from "@nestjs/common"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { agentMessageAttachmentDocumentFactory } from "./agent-message-attachment-document.factory"
import { AgentMessageAttachmentDocumentsService } from "./agent-message-attachment-documents.service"

describe("AgentMessageAttachmentDocumentsService", () => {
  let service: AgentMessageAttachmentDocumentsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
    })
    service = setup.module.get<AgentMessageAttachmentDocumentsService>(
      AgentMessageAttachmentDocumentsService,
    )
    repositories = setup.getAllRepositories()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  it("should create and find an attachment document within the connect scope", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }

    const createdAttachmentDocument = await service.createAttachmentDocument({
      attachmentDocumentId: "00000000-0000-4000-8000-000000000001",
      connectScope,
      fields: {
        fileName: "attachment.pdf",
        mimeType: "application/pdf",
        size: 1234,
        storageRelativePath: `${organization.id}/${project.id}/attachment.pdf`,
      },
    })

    const foundAttachmentDocument = await service.findById({
      attachmentDocumentId: createdAttachmentDocument.id,
      connectScope,
    })

    expect(foundAttachmentDocument?.id).toBe(createdAttachmentDocument.id)
    expect(foundAttachmentDocument?.fileName).toBe("attachment.pdf")
  })

  it("should not find an attachment document outside the connect scope", async () => {
    const firstContext = await createOrganizationWithProject(repositories)
    const secondContext = await createOrganizationWithProject(repositories)
    const firstConnectScope = {
      organizationId: firstContext.organization.id,
      projectId: firstContext.project.id,
    }
    const secondConnectScope = {
      organizationId: secondContext.organization.id,
      projectId: secondContext.project.id,
    }

    const createdAttachmentDocument = await service.createAttachmentDocument({
      attachmentDocumentId: "00000000-0000-4000-8000-000000000002",
      connectScope: firstConnectScope,
      fields: {
        fileName: "attachment.pdf",
        mimeType: "application/pdf",
        size: 1234,
        storageRelativePath: `${firstContext.organization.id}/${firstContext.project.id}/attachment.pdf`,
      },
    })

    const foundAttachmentDocument = await service.findById({
      attachmentDocumentId: createdAttachmentDocument.id,
      connectScope: secondConnectScope,
    })

    expect(foundAttachmentDocument).toBeNull()
  })

  it("should persist the rendered page count on the attachment document", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }

    const createdAttachmentDocument = await service.createAttachmentDocument({
      attachmentDocumentId: "00000000-0000-4000-8000-000000000003",
      connectScope,
      fields: {
        fileName: "attachment.pdf",
        mimeType: "application/pdf",
        size: 1234,
        storageRelativePath: `${organization.id}/${project.id}/attachment.pdf`,
      },
    })
    expect(createdAttachmentDocument.pdfPageCount).toBeNull()

    await service.updatePdfPageCount({
      attachmentDocumentId: createdAttachmentDocument.id,
      connectScope,
      pdfPageCount: 3,
    })

    const foundAttachmentDocument = await service.findById({
      attachmentDocumentId: createdAttachmentDocument.id,
      connectScope,
    })
    expect(foundAttachmentDocument?.pdfPageCount).toBe(3)
  })

  it("copies an attachment document as a new row for the same stored file", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const original = await repositories.agentMessageAttachmentDocumentRepository.save(
      agentMessageAttachmentDocumentFactory
        .transient({ organization, project })
        .build({ pdfPageCount: 3 }),
    )

    const copy = await service.copyAttachmentDocument({
      attachmentDocumentId: original.id,
      connectScope,
    })

    expect(copy.id).not.toBe(original.id)
    expect(copy).toMatchObject({
      organizationId: organization.id,
      projectId: project.id,
      fileName: original.fileName,
      mimeType: original.mimeType,
      size: original.size,
      storageRelativePath: original.storageRelativePath,
      pdfPageCount: 3,
    })
  })

  it("does not copy an attachment document outside the connect scope", async () => {
    const firstContext = await createOrganizationWithProject(repositories)
    const secondContext = await createOrganizationWithProject(repositories)
    const original = await repositories.agentMessageAttachmentDocumentRepository.save(
      agentMessageAttachmentDocumentFactory
        .transient({ organization: firstContext.organization, project: firstContext.project })
        .build(),
    )

    await expect(
      service.copyAttachmentDocument({
        attachmentDocumentId: original.id,
        connectScope: {
          organizationId: secondContext.organization.id,
          projectId: secondContext.project.id,
        },
      }),
    ).rejects.toThrow(NotFoundException)
  })
})

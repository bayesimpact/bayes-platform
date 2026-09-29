import {
  DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER,
  documentUploadContentLengthRange,
} from "@caseai-connect/api-contracts"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { LocalStorageService } from "../storage/local-storage.service"
import { documentsServiceTestSetup } from "./test-setup"

const getTestContext = documentsServiceTestSetup()

describe("project document file upload", () => {
  it("stays pending until the file is stored, then queues extraction", async () => {
    const { service, repositories, fileStorageService, embeddingsBatchService } = getTestContext()
    const enqueue = embeddingsBatchService.enqueueCreateEmbeddingsForDocument as jest.Mock
    enqueue.mockClear()

    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const documentSource = await createFeed(getTestContext().documentSourcesService, connectScope)
    const pending = await service.createPendingProjectDocumentUpload({
      connectScope,
      userId: user.id,
      fileName: "notes.pdf",
      mimeType: "application/pdf",
      size: 8,
      title: "Helpful notes",
      sourceUrl: "https://example.com/notes.pdf",
      documentSourceId: documentSource.id,
    })

    expect(pending.document).toMatchObject({
      title: "Helpful notes",
      fileName: "notes.pdf",
      mimeType: "application/pdf",
      size: 8,
      sourceType: "project",
      sourceUrl: "https://example.com/notes.pdf",
      documentSourceId: documentSource.id,
      uploadStatus: "pending",
      embeddingStatus: "pending",
    })
    expect(pending.uploadUrl).toContain("/local-presign-upload/")
    expect(pending.uploadHeaders).toEqual({
      "Content-Type": "application/pdf",
      [DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER]: documentUploadContentLengthRange(),
    })
    expect(enqueue).not.toHaveBeenCalled()

    const storedPending = await repositories.documentRepository.findOneByOrFail({
      id: pending.document.id,
    })
    expect(storedPending.content).toBeNull()
    expect(storedPending.embeddingStatus).toBe("pending")

    await expect(
      service.confirmProjectDocumentUpload({
        connectScope,
        userId: user.id,
        documentId: pending.document.id,
      }),
    ).rejects.toThrow("Upload is missing")

    if (!(fileStorageService instanceof LocalStorageService)) {
      throw new Error("Expected local file storage in tests")
    }
    const bytes = Buffer.from("%PDF-1.4")
    await fileStorageService.handleLocalUpload(uploadToken(pending.uploadUrl), bytes)

    const confirmed = await service.confirmProjectDocumentUpload({
      connectScope,
      userId: user.id,
      documentId: pending.document.id,
    })
    expect(confirmed.uploadStatus).toBe("uploaded")
    expect(confirmed.embeddingStatus).toBe("queued")
    expect(confirmed.content).toBeNull()
    await expect(fileStorageService.readFile(confirmed.storageRelativePath)).resolves.toEqual(bytes)
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: pending.document.id,
        organizationId: organization.id,
        projectId: project.id,
        uploadedByUserId: user.id,
        origin: "document-upload",
      }),
    )

    await expect(
      service.confirmProjectDocumentUpload({
        connectScope,
        userId: user.id,
        documentId: pending.document.id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it("uses the file name when the title is omitted", async () => {
    const { service, repositories, documentSourcesService } = getTestContext()
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const documentSource = await createFeed(documentSourcesService, connectScope)

    const pending = await service.createPendingProjectDocumentUpload({
      connectScope,
      userId: user.id,
      fileName: "report.pdf",
      mimeType: "application/pdf",
      size: 4,
      documentSourceId: documentSource.id,
    })

    expect(pending.document.title).toBe("report.pdf")
    expect(pending.document.sourceUrl).toBeNull()
  })

  it("returns not found when the document does not exist", async () => {
    const { service, repositories } = getTestContext()
    const { organization, project, user } = await createOrganizationWithProject(repositories)

    await expect(
      service.confirmProjectDocumentUpload({
        connectScope: { organizationId: organization.id, projectId: project.id },
        userId: user.id,
        documentId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it("returns not found when the document feed is outside the project", async () => {
    const { service, repositories, documentSourcesService } = getTestContext()
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const other = await createOrganizationWithProject(repositories)
    const otherSource = await createFeed(documentSourcesService, {
      organizationId: other.organization.id,
      projectId: other.project.id,
    })

    await expect(
      service.createPendingProjectDocumentUpload({
        connectScope: { organizationId: organization.id, projectId: project.id },
        userId: user.id,
        fileName: "report.pdf",
        mimeType: "application/pdf",
        size: 4,
        documentSourceId: otherSource.id,
      }),
    ).rejects.toThrow(`Document source ${otherSource.id} not found`)
  })
})

function uploadToken(uploadUrl: string): string {
  const token = new URL(uploadUrl).pathname.split("/").pop()
  if (!token) throw new Error("Upload URL is missing a token")
  return token
}

function createFeed(
  documentSourcesService: ReturnType<typeof getTestContext>["documentSourcesService"],
  connectScope: { organizationId: string; projectId: string },
) {
  return documentSourcesService.createOne(connectScope, {
    name: "Site crawler",
    type: null,
    externalId: null,
    baseUrl: null,
    config: null,
  })
}

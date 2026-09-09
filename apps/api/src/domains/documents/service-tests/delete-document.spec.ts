import { NotFoundException } from "@nestjs/common"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { documentFactory } from "../document.factory"
import { documentsServiceTestSetup } from "./test-setup"

const getTestContext = documentsServiceTestSetup()

describe("deleteDocument", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should delete a document for a project", async () => {
    const { service, repositories } = getTestContext()

    const { organization, project } = await createOrganizationWithProject(repositories)

    const document = documentFactory.transient({ organization, project }).build({
      title: "Document to delete",
      fileName: "file.pdf",
    })
    await repositories.documentRepository.save(document)

    await service.deleteDocument({
      connectScope: { organizationId: organization.id, projectId: project.id },
      documentId: document.id,
    })

    const deletedDocument = await repositories.documentRepository.findOne({
      where: { id: document.id },
    })
    expect(deletedDocument).toBeNull()
  })

  it("should remove the source file and every rendered page from storage", async () => {
    const { service, repositories, fileStorageService } = getTestContext()
    const deleteFileSpy = jest.spyOn(fileStorageService, "deleteFile").mockResolvedValue()

    const { organization, project } = await createOrganizationWithProject(repositories)
    const document = documentFactory.transient({ organization, project }).build({
      fileName: "file.pdf",
      storageRelativePath: `${organization.id}/${project.id}/doc1.pdf`,
      pdfPageCount: 2,
    })
    await repositories.documentRepository.save(document)

    await service.deleteDocument({
      connectScope: { organizationId: organization.id, projectId: project.id },
      documentId: document.id,
    })

    const deletedPaths = deleteFileSpy.mock.calls.map(
      ([storageRelativePath]) => storageRelativePath,
    )
    expect(deletedPaths.sort()).toEqual(
      [
        `${organization.id}/${project.id}/doc1.pdf`,
        `${organization.id}/${project.id}/derived/doc1/page-1.png`,
        `${organization.id}/${project.id}/derived/doc1/page-2.png`,
      ].sort(),
    )
  })

  it("should only remove the source file when no page was rendered", async () => {
    const { service, repositories, fileStorageService } = getTestContext()
    const deleteFileSpy = jest.spyOn(fileStorageService, "deleteFile").mockResolvedValue()

    const { organization, project } = await createOrganizationWithProject(repositories)
    const document = documentFactory.transient({ organization, project }).build({
      fileName: "file.pdf",
      storageRelativePath: `${organization.id}/${project.id}/doc1.pdf`,
      pdfPageCount: null,
    })
    await repositories.documentRepository.save(document)

    await service.deleteDocument({
      connectScope: { organizationId: organization.id, projectId: project.id },
      documentId: document.id,
    })

    expect(deleteFileSpy).toHaveBeenCalledTimes(1)
    expect(deleteFileSpy).toHaveBeenCalledWith(`${organization.id}/${project.id}/doc1.pdf`)
  })

  it("should not touch storage for a crawled document without a stored file", async () => {
    const { service, repositories, fileStorageService } = getTestContext()
    const deleteFileSpy = jest.spyOn(fileStorageService, "deleteFile").mockResolvedValue()

    const { organization, project } = await createOrganizationWithProject(repositories)
    const document = documentFactory.transient({ organization, project }).build({
      sourceType: "webCrawl",
      storageRelativePath: null as unknown as string,
    })
    await repositories.documentRepository.save(document)

    await service.deleteDocument({
      connectScope: { organizationId: organization.id, projectId: project.id },
      documentId: document.id,
    })

    expect(deleteFileSpy).not.toHaveBeenCalled()
    const deletedDocument = await repositories.documentRepository.findOne({
      where: { id: document.id },
    })
    expect(deletedDocument).toBeNull()
  })

  it("should still delete the document when storage cleanup fails", async () => {
    const { service, repositories, fileStorageService } = getTestContext()
    jest.spyOn(fileStorageService, "deleteFile").mockRejectedValue(new Error("storage down"))

    const { organization, project } = await createOrganizationWithProject(repositories)
    const document = documentFactory.transient({ organization, project }).build({
      fileName: "file.pdf",
      storageRelativePath: `${organization.id}/${project.id}/doc1.pdf`,
      pdfPageCount: 2,
    })
    await repositories.documentRepository.save(document)

    await expect(
      service.deleteDocument({
        connectScope: { organizationId: organization.id, projectId: project.id },
        documentId: document.id,
      }),
    ).resolves.toBe(true)

    const deletedDocument = await repositories.documentRepository.findOne({
      where: { id: document.id },
    })
    expect(deletedDocument).toBeNull()
  })

  it("should throw NotFoundException when document does not exist", async () => {
    const { service, repositories } = getTestContext()

    const { organization, project } = await createOrganizationWithProject(repositories)

    const nonExistentDocumentId = "00000000-0000-0000-0000-000000000000"

    await expect(
      service.deleteDocument({
        connectScope: { organizationId: organization.id, projectId: project.id },
        documentId: nonExistentDocumentId,
      }),
    ).rejects.toThrow(NotFoundException)
  })

  it("should throw NotFoundException when document belongs to another project", async () => {
    const { service, repositories, fileStorageService } = getTestContext()
    const deleteFileSpy = jest.spyOn(fileStorageService, "deleteFile").mockResolvedValue()

    const firstContext = await createOrganizationWithProject(repositories)
    const secondContext = await createOrganizationWithProject(repositories)
    const document = documentFactory
      .transient({ organization: firstContext.organization, project: firstContext.project })
      .build({ fileName: "file.pdf" })
    await repositories.documentRepository.save(document)

    await expect(
      service.deleteDocument({
        connectScope: {
          organizationId: secondContext.organization.id,
          projectId: secondContext.project.id,
        },
        documentId: document.id,
      }),
    ).rejects.toThrow(NotFoundException)

    expect(deleteFileSpy).not.toHaveBeenCalled()
    const untouchedDocument = await repositories.documentRepository.findOne({
      where: { id: document.id },
    })
    expect(untouchedDocument).not.toBeNull()
  })
})

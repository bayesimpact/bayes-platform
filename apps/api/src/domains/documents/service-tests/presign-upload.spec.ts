import { MimeTypes } from "@caseai-connect/api-contracts"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { documentsServiceTestSetup } from "./test-setup"

const getTestContext = documentsServiceTestSetup()

describe("presignUpload", () => {
  it("creates a pending document owned by the user and returns its upload URL", async () => {
    const { service, repositories } = getTestContext()
    const { organization, project, user } = await createOrganizationWithProject(repositories)

    const result = await service.presignUpload({
      connectScope: { organizationId: organization.id, projectId: project.id },
      userId: user.id,
      sourceType: "extraction",
      file: { fileName: "invoice.pdf", mimeType: MimeTypes.pdf, size: 1234 },
    })

    expect(result.uploadUrl).toEqual(expect.any(String))
    const document = await repositories.documentRepository.findOneByOrFail({
      id: result.documentId,
    })
    expect(document.uploadStatus).toBe("pending")
    expect(document.sourceType).toBe("extraction")
    expect(document.userId).toBe(user.id)
    expect(document.fileName).toBe("invoice.pdf")
    expect(document.title).toBe("invoice.pdf")
    expect(document.mimeType).toBe("application/pdf")
    expect(document.size).toBe(1234)
    expect(document.storageRelativePath).toBe(
      `${organization.id}/${project.id}/${result.documentId}.pdf`,
    )
  })

  it("rejects a file type that is not allowed", async () => {
    const { service, repositories } = getTestContext()
    const { organization, project, user } = await createOrganizationWithProject(repositories)

    await expect(
      service.presignUpload({
        connectScope: { organizationId: organization.id, projectId: project.id },
        userId: user.id,
        sourceType: "extraction",
        file: { fileName: "script.sh", mimeType: "application/x-sh" as never, size: 10 },
      }),
    ).rejects.toThrow("Invalid file type")

    expect(await repositories.documentRepository.count()).toBe(0)
  })
})

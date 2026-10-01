import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { documentsServiceTestSetup } from "./test-setup"

const getTestContext = documentsServiceTestSetup()

describe("createInlineProjectDocument", () => {
  it("stores the text, optional source URL, and marks embeddings queued", async () => {
    const { service, repositories, fileStorageService, documentSourcesService } = getTestContext()
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const documentSource = await documentSourcesService.createOne(connectScope, {
      name: "Site crawler",
      type: null,
      externalId: null,
      baseUrl: null,
      config: null,
    })

    const document = await service.createInlineProjectDocument({
      connectScope,
      userId: user.id,
      title: "Helpful notes",
      content: "The assistant stored this page.",
      sourceUrl: "https://example.com/notes",
      documentSourceId: documentSource.id,
    })

    expect(document.title).toBe("Helpful notes")
    expect(document.content).toBe("The assistant stored this page.")
    expect(document.sourceUrl).toBe("https://example.com/notes")
    expect(document.documentSourceId).toBe(documentSource.id)
    expect(document.sourceType).toBe("project")
    expect(document.uploadStatus).toBe("uploaded")
    expect(document.mimeType).toBe("text/plain")
    expect(document.userId).toBe(user.id)
    expect(document.embeddingStatus).toBe("queued")
    await expect(fileStorageService.readFile(document.storageRelativePath)).resolves.toEqual(
      Buffer.from("The assistant stored this page.", "utf8"),
    )
  })
})

import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { documentFactory } from "../document.factory"
import { documentsServiceTestSetup } from "./test-setup"

const getTestContext = documentsServiceTestSetup()

describe("listDocuments", () => {
  it("should return documents for a project", async () => {
    const { service, repositories } = getTestContext()

    const { organization, project } = await createOrganizationWithProject(repositories)

    const document1 = documentFactory.transient({ organization, project }).build({
      title: "Document 1",
      fileName: "file1.pdf",
    })
    const document2 = documentFactory.transient({ organization, project }).build({
      title: "Document 2",
      fileName: "file2.pdf",
    })
    const deletedDocument = documentFactory.transient({ organization, project }).build({
      title: "Deleted Document",
      fileName: "file2.pdf",
      deletedAt: new Date(),
    })
    await repositories.documentRepository.save([document1, document2, deletedDocument])

    const result = await service.listDocuments(
      {
        organizationId: organization.id,
        projectId: project.id,
      },
      "project",
    )

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.title)).toContain("Document 1")
    expect(result.map((r) => r.title)).toContain("Document 2")
  })
})

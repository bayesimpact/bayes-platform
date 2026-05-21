import { DocumentsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { documentFactory } from "@/domains/documents/document.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentsModule } from "../documents.module"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Documents - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DocumentsModule],
      applyOverrides: (moduleBuilder) =>
        withDocumentAuthAndEmbeddingsMocks(moduleBuilder, () => auth0Id),
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
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      projectMembership: { role: "admin" },
    })
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const subject = async (sourceType = "project") =>
    request({
      route: DocumentsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, sourceType }),
      token: accessToken,
    })

  it("should return documents for a project", async () => {
    const { organization, project } = await createContext()

    const document1 = documentFactory.transient({ organization, project }).build({
      title: "Document 1",
      fileName: "file1.pdf",
    })
    const document2 = documentFactory.transient({ organization, project }).build({
      title: "Document 2",
      fileName: "file2.pdf",
    })
    await repositories.documentRepository.save([document1, document2])

    const response = await subject()

    expectResponse(response, 200)
    const documents = response.body.data
    expect(documents).toHaveLength(2)
    expect(documents.map((document) => document.title)).toContain("Document 1")
    expect(documents.map((document) => document.title)).toContain("Document 2")
    expect(documents[0]).toHaveProperty("id")
    expect(documents[0]).toHaveProperty("createdAt")
    expect(documents[0]).toHaveProperty("updatedAt")
    expect(documents[0]).toHaveProperty("embeddingStatus")
  })

  it("should return empty array when project has no documents", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })
})

import { DocumentsRoutes, PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import type { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentsModule } from "../documents.module"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Documents - getTemporaryUrl", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentId: string
  let storagePath: string
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

  const createContext = async ({
    projectMembership,
    isPublic = false,
  }: {
    projectMembership?: Partial<ProjectMembership>
    isPublic?: boolean
  } = {}) => {
    const { user, organization, project, document } = await createOrganizationWithDocument(
      repositories,
      {
        projectMembership,
        document: {
          storageRelativePath: "org-id/project-id/file-id.pdf",
        },
      },
    )
    organizationId = organization.id
    projectId = project.id
    documentId = document.id
    storagePath = document.storageRelativePath
    auth0Id = user.auth0Id

    if (isPublic) {
      const documentTagRepository = setup.getRepository(DocumentTag)
      const publicDocumentsTag = documentTagFactory
        .transient({ organization, project })
        .build({ name: PUBLIC_DOCUMENTS_TAG_NAME })
      await documentTagRepository.save(publicDocumentsTag)
      document.tags = [publicDocumentsTag]
      await repositories.documentRepository.save(document)
    }

    return { organization, project, document }
  }

  const subject = async () =>
    request({
      route: DocumentsRoutes.getTemporaryUrl,
      pathParams: removeNullish({ organizationId, projectId, documentId }),
      token: accessToken,
    })

  it("should return a temporary URL for a document", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    const { url } = response.body.data
    expect(url).toBeDefined()
    expect(typeof url).toBe("string")
    expect(url).toContain(storagePath)
  })
  it("should let a simple member download a public document", async () => {
    await createContext({ projectMembership: { role: "member" }, isPublic: true })

    const response = await subject()

    expectResponse(response, 201)
    const { url } = response.body.data
    expect(url).toBeDefined()
    expect(typeof url).toBe("string")
    expect(url).toContain(storagePath)
  })

  it("should forbid a simple member from downloading a non-public document", async () => {
    await createContext({ projectMembership: { role: "member" }, isPublic: false })

    const response = await subject()

    expectResponse(response, 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })
})

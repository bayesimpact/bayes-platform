import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import { EvalDocumentsRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { documentTagFactory } from "@/domains/documents/tags/document-tag.factory"
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import type { ProjectMembershipFixture } from "@/domains/projects/memberships/project-membership.types"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { EvalModule } from "../../eval.module"

describe("Evaluation documents - getIsPublic", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let documentId: string
  let authSubject = "oidc|123"

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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async ({
    projectMembership,
    isPublic = false,
  }: {
    projectMembership?: Partial<ProjectMembershipFixture>
    isPublic?: boolean
  } = {}) => {
    const { user, organization, project, document } = await createOrganizationWithDocument(
      repositories,
      { projectMembership },
    )
    organizationId = organization.id
    projectId = project.id
    documentId = document.id
    authSubject = user.authSubject!

    if (isPublic) {
      const publicDocumentsTag = documentTagFactory
        .transient({ organization, project })
        .build({ name: PUBLIC_DOCUMENTS_TAG_NAME })
      await setup.getRepository(DocumentTag).save(publicDocumentsTag)
      document.tags = [publicDocumentsTag]
      await repositories.documentRepository.save(document)
    }
  }

  const subject = async () =>
    request({
      route: EvalDocumentsRoutes.getIsPublic,
      pathParams: { organizationId, projectId, documentId },
      token: "token",
    })

  it("returns true when the document is tagged public-documents", async () => {
    await createContext({ isPublic: true })

    const response = await subject()

    expectSchemaResponse(EvalDocumentsRoutes.getIsPublic, response)
    expect(response.body.data.isPublicDocument).toBe(true)
  })

  it("returns false when the document is not tagged public-documents", async () => {
    await createContext({ isPublic: false })

    const response = await subject()

    expectSchemaResponse(EvalDocumentsRoutes.getIsPublic, response)
    expect(response.body.data.isPublicDocument).toBe(false)
  })

  it("lets a simple member check a document's public status", async () => {
    await createContext({ projectMembership: { roleKeys: ["project_member"] }, isPublic: true })

    const response = await subject()

    expectSchemaResponse(EvalDocumentsRoutes.getIsPublic, response)
    expect(response.body.data.isPublicDocument).toBe(true)
  })
})

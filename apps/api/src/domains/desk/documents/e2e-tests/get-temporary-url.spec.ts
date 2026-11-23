import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import { DeskDocumentsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
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
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk documents - getTemporaryUrl", () => {
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
      additionalImports: [DeskModule],
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
      { projectMembership, document: { storageRelativePath: "org-id/project-id/file-id.pdf" } },
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
      route: DeskDocumentsRoutes.getTemporaryUrl,
      pathParams: { organizationId, projectId, documentId },
      token: "token",
    })

  it("returns a temporary URL for a document", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskDocumentsRoutes.getTemporaryUrl, response, 201)
    expect(typeof response.body.data.url).toBe("string")
  })

  it("lets a simple member download a public document", async () => {
    await createContext({ projectMembership: { roleKeys: ["project_member"] }, isPublic: true })

    expectSchemaResponse(DeskDocumentsRoutes.getTemporaryUrl, await subject(), 201)
  })

  it("answers 403 for a document that is not public to a member without document.read", async () => {
    await createContext({ projectMembership: { roleKeys: ["project_member"] }, isPublic: false })

    expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })
})

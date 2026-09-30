import { DocumentSourcesRoutes } from "@caseai-connect/api-contracts"
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
import { createDocumentForProject } from "@/domains/documents/document.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { DocumentsModule } from "../documents.module"
import { DocumentSourcesService } from "../sources/document-sources.service"
import { withDocumentAuthAndEmbeddingsMocks } from "../test-overrides"

describe("Document sources - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let documentSourcesService: DocumentSourcesService

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
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    documentSourcesService = setup.module.get(DocumentSourcesService)
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

  const createContext = async (role: "owner" | "admin" | "member" = "owner") => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      projectMembership: { role },
    })
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project }
  }

  const subject = async () =>
    request({
      route: DocumentSourcesRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("returns feeds with document count, last sync, and status", async () => {
    const { organization, project } = await createContext("admin")
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const documentSource = await documentSourcesService.createOne(connectScope, {
      name: "Site crawler",
      type: "site-crawler",
      externalId: "example.com",
      baseUrl: "https://example.com",
      config: null,
    })
    const syncedAt = new Date("2026-03-01T12:00:00.000Z")
    await createDocumentForProject({
      repositories,
      organization,
      project,
      params: {
        document: {
          documentSourceId: documentSource.id,
          embeddingStatus: "failed",
          createdAt: syncedAt,
          sourceType: "app",
        },
      },
    })

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: documentSource.id,
        name: "Site crawler",
        type: "site-crawler",
        externalId: "example.com",
        baseUrl: "https://example.com",
        documentCount: 1,
        indexedDocumentCount: 0,
        lastSyncedAt: syncedAt.getTime(),
        status: "error",
      }),
    ])
  })

  it("requires an authentication token", async () => {
    await createContext()
    accessToken = undefined
    expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("does not allow a project member to list feeds", async () => {
    await createContext("member")
    expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })
})

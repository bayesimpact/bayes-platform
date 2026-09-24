import { randomUUID } from "node:crypto"
import {
  AppsV1Routes,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../test/request"
import { AppsModule } from "../apps.module"
import { AppsService } from "../apps.service"

describe("Apps - Ingest document", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule],
      applyOverrides: withDocumentEmbeddingsBatchServiceMock,
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const postDocument = (params: {
    projectId: string
    token?: string
    body?: Record<string, unknown>
  }) => {
    const req = request(app.getHttpServer())
      .post(AppsV1Routes.createDocument.getPath({ projectId: params.projectId }))
      .set("Connection", "close")
    if (params.token) {
      req.set("Authorization", `Bearer ${params.token}`)
    }
    if (params.body) {
      req.send(params.body)
    }
    return req
  }

  const installAndIssueToken = async (permissions: readonly string[]) => {
    const appsService = setup.module.get(AppsService)
    const { project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const slug = `ingest-${randomUUID().slice(0, 8)}`
    await appsService.createAppManifest({
      name: "Helpful Assistant",
      slug,
      description: null,
      logoUrl: null,
      grantablePermissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
    })
    const credentials = await appsService.authorizeInstall({
      slug,
      userId: user.id,
      projectId: project.id,
      permissions,
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
    })
    const token = await appsService.issueToken({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    })
    return { project, accessToken: token.accessToken }
  }

  it("creates a project document from inline text without fetching source_url", async () => {
    const { project, accessToken } = await installAndIssueToken([
      DOCUMENT_READ_PERMISSION,
      DOCUMENT_CREATE_PERMISSION,
    ])
    const created = await postDocument({
      projectId: project.id,
      token: accessToken,
      body: {
        title: "Helpful notes",
        content: "The assistant stored this page.",
        source_url: "https://example.com/notes",
      },
    })
    expectResponse(created, 201)
    expect(created.body.data).toMatchObject({
      title: "Helpful notes",
      projectId: project.id,
      sourceUrl: "https://example.com/notes",
      embeddingStatus: "queued",
    })

    const stored = await repositories.documentRepository.findOneByOrFail({
      id: created.body.data.id,
    })
    expect(stored.content).toBe("The assistant stored this page.")
    expect(stored.sourceType).toBe("project")
    expect(stored.sourceUrl).toBe("https://example.com/notes")
  })

  it("returns 403 when the path project is not the token project", async () => {
    const { accessToken } = await installAndIssueToken([DOCUMENT_CREATE_PERMISSION])
    const other = await createOrganizationWithProject(repositories)
    const created = await postDocument({
      projectId: other.project.id,
      token: accessToken,
      body: { title: "Helpful notes", content: "Nope." },
    })
    expect(created.status).toBe(403)
    expect(created.status).not.toBe(201)
  })

  it("returns 403 when the install was not granted document.create", async () => {
    const { project, accessToken } = await installAndIssueToken([DOCUMENT_READ_PERMISSION])
    const created = await postDocument({
      projectId: project.id,
      token: accessToken,
      body: { title: "Helpful notes", content: "Nope." },
    })
    expectResponse(created, 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("returns 401 without an App JWT and 400 for an empty body", async () => {
    const { project, accessToken } = await installAndIssueToken([DOCUMENT_CREATE_PERMISSION])
    expectResponse(await postDocument({ projectId: project.id }), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(
      await postDocument({
        projectId: project.id,
        token: accessToken,
        body: { title: "Helpful notes" },
      }),
      400,
      "Invalid document payload",
    )
  })
})

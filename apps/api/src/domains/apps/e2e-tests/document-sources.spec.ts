import { randomUUID } from "node:crypto"
import {
  AppsDocumentSourcesRoutes,
  DOCUMENT_SOURCE_CREATE_PERMISSION,
  DOCUMENT_SOURCE_DELETE_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
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
import { createDocumentForProject } from "@/domains/documents/document.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../test/request"
import { AppsModule } from "../apps.module"
import { AppsService } from "../apps.service"

const ALL_SOURCE_PERMISSIONS = [
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_CREATE_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  DOCUMENT_SOURCE_DELETE_PERMISSION,
] as const

describe("Apps - Document sources", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule],
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

  const installAndIssueToken = async (permissions: readonly string[]) => {
    const appsService = setup.module.get(AppsService)
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const slug = `feed-${randomUUID().slice(0, 8)}`
    await appsService.createAppManifest({
      name: "Helpful Assistant",
      slug,
      description: null,
      logoUrl: null,
      grantablePermissions: [...ALL_SOURCE_PERMISSIONS],
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
    return { organization, project, accessToken: token.accessToken }
  }

  const call = (params: {
    method: "get" | "post" | "patch" | "delete"
    path: string
    token?: string
    body?: Record<string, unknown>
  }) => {
    const http = request(app.getHttpServer())
    const req = http[params.method](params.path).set("Connection", "close")
    if (params.token) req.set("Authorization", `Bearer ${params.token}`)
    if (params.body) req.send(params.body)
    return req
  }

  it("creates, lists, updates, and deletes a feed", async () => {
    const { project, accessToken } = await installAndIssueToken(ALL_SOURCE_PERMISSIONS)
    const created = await call({
      method: "post",
      path: AppsDocumentSourcesRoutes.createOne.getPath({ projectId: project.id }),
      token: accessToken,
      body: {
        name: "Site crawler",
        type: "site-crawler",
        external_id: "example.com",
        base_url: "https://example.com",
        config: { depth: 2 },
      },
    })
    expectResponse(created, 201)
    expect(created.body.data).toMatchObject({
      name: "Site crawler",
      type: "site-crawler",
      externalId: "example.com",
      baseUrl: "https://example.com",
    })
    expect(created.body.data.config).toBeUndefined()
    expect(typeof created.body.data.createdAt).toBe("number")

    const sourceId = created.body.data.id as string
    const listed = await call({
      method: "get",
      path: `${AppsDocumentSourcesRoutes.getAll.getPath({ projectId: project.id })}?external_id=example.com`,
      token: accessToken,
    })
    expectResponse(listed, 200)
    expect(listed.body.data).toHaveLength(1)
    expect(listed.body.data[0].config).toBeUndefined()

    const updated = await call({
      method: "patch",
      path: AppsDocumentSourcesRoutes.updateOne.getPath({ projectId: project.id, id: sourceId }),
      token: accessToken,
      body: { name: "Renamed crawler" },
    })
    expectResponse(updated, 200)
    expect(updated.body.data.name).toBe("Renamed crawler")

    const removed = await call({
      method: "delete",
      path: AppsDocumentSourcesRoutes.deleteOne.getPath({ projectId: project.id, id: sourceId }),
      token: accessToken,
    })
    expectResponse(removed, 200)
    expect(removed.body.data).toEqual({ success: true })
  })

  it("returns 409 when external_id is already used in the project", async () => {
    const { project, accessToken } = await installAndIssueToken(ALL_SOURCE_PERMISSIONS)
    const body = { name: "Site crawler", external_id: "example.com" }
    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentSourcesRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body,
      }),
      201,
    )
    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentSourcesRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body,
      }),
      409,
      "A document source with this external id already exists",
    )
  })

  it("returns 409 when deleting a feed that still has documents", async () => {
    const { organization, project, accessToken } =
      await installAndIssueToken(ALL_SOURCE_PERMISSIONS)
    const created = await call({
      method: "post",
      path: AppsDocumentSourcesRoutes.createOne.getPath({ projectId: project.id }),
      token: accessToken,
      body: { name: "Site crawler", external_id: "example.com" },
    })
    const sourceId = created.body.data.id as string
    const document = await createDocumentForProject({ repositories, organization, project })
    await repositories.documentRepository.update(document.id, { documentSourceId: sourceId })

    expectResponse(
      await call({
        method: "delete",
        path: AppsDocumentSourcesRoutes.deleteOne.getPath({ projectId: project.id, id: sourceId }),
        token: accessToken,
      }),
      409,
      "Document source still has documents attached",
    )
  })

  it("hides a feed that belongs to another project", async () => {
    const caller = await installAndIssueToken(ALL_SOURCE_PERMISSIONS)
    const other = await installAndIssueToken(ALL_SOURCE_PERMISSIONS)
    const created = await call({
      method: "post",
      path: AppsDocumentSourcesRoutes.createOne.getPath({ projectId: other.project.id }),
      token: other.accessToken,
      body: { name: "Other feed" },
    })
    const sourceId = created.body.data.id as string

    expectResponse(
      await call({
        method: "get",
        path: AppsDocumentSourcesRoutes.getOne.getPath({
          projectId: other.project.id,
          id: sourceId,
        }),
        token: caller.accessToken,
      }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
    expectResponse(
      await call({
        method: "get",
        path: AppsDocumentSourcesRoutes.getOne.getPath({
          projectId: caller.project.id,
          id: sourceId,
        }),
        token: caller.accessToken,
      }),
      404,
      `Document source ${sourceId} not found`,
    )
  })

  it("returns 403 without document_source.create and 401 without a token", async () => {
    const { project, accessToken } = await installAndIssueToken([DOCUMENT_SOURCE_READ_PERMISSION])
    expectResponse(
      await call({
        method: "post",
        path: AppsDocumentSourcesRoutes.createOne.getPath({ projectId: project.id }),
        token: accessToken,
        body: { name: "Site crawler" },
      }),
      403,
      AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
    )
    expectResponse(
      await call({
        method: "get",
        path: AppsDocumentSourcesRoutes.getAll.getPath({ projectId: project.id }),
      }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
  })
})

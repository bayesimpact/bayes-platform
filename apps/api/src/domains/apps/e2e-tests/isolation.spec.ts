import { randomUUID } from "node:crypto"
import {
  AgentsRoutes,
  AppsRoutes,
  AppsV1Routes,
  DOCUMENT_READ_PERMISSION,
  DocumentsRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersService } from "@/domains/users/users.service"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, testRequester } from "../../../../test/request"
import { DEFAULT_APPS_JWT_AUDIENCE, signAppJwt } from "../app-jwt"
import { AppsModule } from "../apps.module"
import { AppsService } from "../apps.service"

describe("Apps - JWT isolation", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule],
      applyOverrides: withDocumentEmbeddingsBatchServiceMock,
    })
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const installAndIssueToken = async () => {
    const repositories = setup.getAllRepositories()
    const appsService = setup.module.get(AppsService)
    const { project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const created = await appsService.createAppManifest({
      name: "Helpful Assistant",
      slug: "isolation-assistant",
      description: null,
      logoUrl: null,
      grantablePermissions: [DOCUMENT_READ_PERMISSION],
    })
    const authorized = await appsService.authorizeInstall({
      slug: created.slug,
      userId: user.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
    })
    const token = await appsService.issueToken({
      grant_type: "client_credentials",
      client_id: authorized.clientId,
      client_secret: authorized.clientSecret,
    })
    return {
      slug: created.slug,
      accessToken: token.accessToken,
      projectId: project.id,
      organizationId: project.organizationId,
    }
  }

  it("accepts an App JWT on /apps/v1/me without calling UserGuard.findOrCreate", async () => {
    const { accessToken, projectId } = await installAndIssueToken()
    const findOrCreate = jest.spyOn(setup.module.get(UsersService), "findOrCreate")

    const me = await testRequester(app)({
      route: AppsV1Routes.getMe,
      token: accessToken,
    })
    expectResponse(me, 200)
    expect(me.body.data.projectId).toBe(projectId)
    expect(findOrCreate).not.toHaveBeenCalled()
  })

  it("rejects a human-shaped JWT on /apps/v1/me with 401", async () => {
    const privateKey = process.env.APPS_JWT_PRIVATE_KEY
    if (!privateKey) throw new Error("APPS_JWT_PRIVATE_KEY must be set in tests")

    const humanShapedToken = signAppJwt({
      privateKey,
      issuer: process.env.AUTH0_ISSUER_URL ?? "https://example.eu.auth0.com/",
      audience: process.env.AUTH0_AUDIENCE ?? DEFAULT_APPS_JWT_AUDIENCE,
      subject: `auth0|${randomUUID()}`,
      projectId: randomUUID(),
      installationId: randomUUID(),
    })
    const me = await testRequester(app)({
      route: AppsV1Routes.getMe,
      token: humanShapedToken,
    })
    expectResponse(me, 401, AUTH_ERRORS.INVALID_ACCESS_TOKEN)
  })

  it("rejects an App JWT on studio /apps/install and revoke with 401, not 403", async () => {
    const { slug, accessToken, projectId } = await installAndIssueToken()
    const findOrCreate = jest.spyOn(setup.module.get(UsersService), "findOrCreate")

    const installPage = await request(app.getHttpServer())
      .get(AppsRoutes.getInstall.getPath({ slug }))
      .set("Connection", "close")
      .set("Authorization", `Bearer ${accessToken}`)

    expect(installPage.status).toBe(401)
    expect(installPage.status).not.toBe(403)

    const installation = await setup
      .getAllRepositories()
      .appInstallationRepository.findOneByOrFail({
        projectId,
      })
    const revoke = await request(app.getHttpServer())
      .post(AppsRoutes.revoke.getPath({ id: installation.id }))
      .set("Connection", "close")
      .set("Authorization", `Bearer ${accessToken}`)

    expect(revoke.status).toBe(401)
    expect(revoke.status).not.toBe(403)

    const listed = await request(app.getHttpServer())
      .get(AppsRoutes.listForProject.getPath({ projectId }))
      .set("Connection", "close")
      .set("Authorization", `Bearer ${accessToken}`)

    expect(listed.status).toBe(401)
    expect(listed.status).not.toBe(403)
    expect(findOrCreate).not.toHaveBeenCalled()
  })

  it("rejects an App JWT on studio document and agent routes with 401, not 403", async () => {
    const { accessToken, projectId, organizationId } = await installAndIssueToken()

    const documents = await request(app.getHttpServer())
      .get(
        DocumentsRoutes.getAll.getPath({
          organizationId,
          projectId,
          sourceType: "project",
        }),
      )
      .set("Connection", "close")
      .set("Authorization", `Bearer ${accessToken}`)

    expect(documents.status).toBe(401)
    expect(documents.status).not.toBe(403)

    const agents = await request(app.getHttpServer())
      .post(AgentsRoutes.createOne.getPath({ organizationId, projectId }))
      .set("Connection", "close")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ payload: { name: "Helpful Assistant" } })

    expect(agents.status).toBe(401)
    expect(agents.status).not.toBe(403)
  })
})

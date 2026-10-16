import { randomUUID } from "node:crypto"
import {
  AgentsRoutes,
  AppsV1Routes,
  DOCUMENT_READ_PERMISSION,
  DocumentsRoutes,
  ProjectAppInstallationsRoutes,
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
import { signOAuthAccessToken } from "@/domains/oauth/oauth-crypto"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersService } from "@/domains/users/users.service"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, testRequester } from "../../../../test/request"
import { AppsModule } from "../apps.module"
import { installAppForTests, useAppsTestOrigin } from "./app-install-test.helpers"

describe("Apps - token isolation", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    useAppsTestOrigin()
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
    const { project, user } = await createOrganizationWithProject(repositories)
    const installed = await installAppForTests(setup.module, {
      userId: user.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
    })
    return {
      accessToken: installed.accessToken,
      installationId: installed.installationId,
      projectId: project.id,
      organizationId: project.organizationId,
    }
  }

  it("accepts an app token on /apps/v1/me without calling UserGuard.findOrCreate", async () => {
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

  it("rejects a token of another issuer on /apps/v1/me with 401", async () => {
    const privateKey = process.env.OAUTH_SIGNING_PRIVATE_KEY
    if (!privateKey) throw new Error("OAUTH_SIGNING_PRIVATE_KEY must be set in tests")

    const issuedAt = Math.floor(Date.now() / 1000)
    const humanShapedToken = signOAuthAccessToken(
      {
        iss: process.env.OIDC_ISSUER_URL ?? "https://idp.example.org/realms/acme",
        aud: "http://apps-api.test/api/apps/v1",
        sub: `oidc|${randomUUID()}`,
        client_id: "app_test",
        grant_id: randomUUID(),
        installation_id: randomUUID(),
        scope: "",
        iat: issuedAt,
        exp: issuedAt + 3600,
        jti: randomUUID(),
      },
      privateKey,
    )
    const me = await testRequester(app)({
      route: AppsV1Routes.getMe,
      token: humanShapedToken,
    })
    expectResponse(me, 401, AUTH_ERRORS.INVALID_ACCESS_TOKEN)
  })

  it("rejects an app token on the studio app installation routes with 401, not 403", async () => {
    const { accessToken, installationId, projectId, organizationId } = await installAndIssueToken()
    const findOrCreate = jest.spyOn(setup.module.get(UsersService), "findOrCreate")

    const listed = await request(app.getHttpServer())
      .get(ProjectAppInstallationsRoutes.getAll.getPath({ organizationId, projectId }))
      .set("Connection", "close")
      .set("Authorization", `Bearer ${accessToken}`)
    const revoke = await request(app.getHttpServer())
      .post(
        ProjectAppInstallationsRoutes.revokeOne.getPath({
          organizationId,
          projectId,
          appInstallationId: installationId,
        }),
      )
      .set("Connection", "close")
      .set("Authorization", `Bearer ${accessToken}`)

    expect(listed.status).toBe(401)
    expect(revoke.status).toBe(401)
    expect(findOrCreate).not.toHaveBeenCalled()
  })

  it("rejects an app token on studio document and agent routes with 401, not 403", async () => {
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

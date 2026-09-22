import { randomUUID } from "node:crypto"
import { AppsV1Routes, DOCUMENT_READ_PERMISSION } from "@caseai-connect/api-contracts"
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
import { APP_INSTALLATION_STATUS_REVOKED } from "@/domains/apps/app-installation.entity"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { assignPlatformStaffToUser, ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, testRequester } from "../../../../test/request"
import { AppsModule } from "../apps.module"
import { AppsService } from "../apps.service"

describe("Apps - Token", () => {
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

  const postToken = (fields: Record<string, string>) =>
    request(app.getHttpServer())
      .post(AppsV1Routes.createToken.getPath())
      .set("Connection", "close")
      .type("form")
      .send(fields)

  const installApp = async () => {
    const appsService = setup.module.get(AppsService)
    const { project, user } = await createOrganizationWithProject(repositories)
    await assignPlatformStaffToUser({ repositories, user })
    const created = await appsService.createAppManifest({
      name: "Helpful Assistant",
      slug: "token-assistant",
      description: null,
      logoUrl: null,
      grantablePermissions: [DOCUMENT_READ_PERMISSION],
    })
    const credentials = await appsService.authorizeInstall({
      slug: created.slug,
      userId: user.id,
      projectId: project.id,
      permissions: [DOCUMENT_READ_PERMISSION],
      redirectUri: "http://127.0.0.1:8787/callback",
      state: "csrf-state",
    })
    return { project, credentials }
  }

  it("exchanges form-urlencoded client credentials for an App JWT and serves /apps/v1/me", async () => {
    const { project, credentials } = await installApp()
    const issued = await postToken({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    })
    expectResponse(issued, 200)
    expect(issued.body.data.tokenType).toBe("Bearer")
    expect(issued.body.data.expiresIn).toBe(3600)
    expect(issued.body.data.accessToken.split(".")).toHaveLength(3)

    const me = await testRequester(app)({
      route: AppsV1Routes.getMe,
      token: issued.body.data.accessToken,
    })
    expectResponse(me, 200)
    expect(me.body.data.projectId).toBe(project.id)
    expect(me.body.data.userId).toBeTruthy()
    expect(me.body.data.installationId).toBeTruthy()
  })

  it("returns 401 for a wrong secret, an unknown client, a revoked install, and a missing token", async () => {
    const { credentials } = await installApp()

    expectResponse(
      await postToken({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: "not-the-secret",
      }),
      401,
      "Invalid client credentials",
    )

    expectResponse(
      await postToken({
        grant_type: "client_credentials",
        client_id: randomUUID(),
        client_secret: "any-secret",
      }),
      401,
      "Invalid client credentials",
    )

    expectResponse(
      await postToken({
        grant_type: "password",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
      401,
      "Invalid client credentials",
    )

    const installation = await repositories.appInstallationRepository.findOneByOrFail({
      clientId: credentials.clientId,
    })
    installation.status = APP_INSTALLATION_STATUS_REVOKED
    installation.revokedAt = new Date()
    await repositories.appInstallationRepository.save(installation)

    expectResponse(
      await postToken({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
      401,
      "Invalid client credentials",
    )

    expectResponse(
      await testRequester(app)({ route: AppsV1Routes.getMe }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
  })
})

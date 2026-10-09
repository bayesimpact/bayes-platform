import { randomUUID } from "node:crypto"
import {
  AppsRoutes,
  AppsV1Routes,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { APP_INSTALLATION_STATUS_REVOKED } from "@/domains/apps/app-installation.entity"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { PermissionService } from "@/domains/rbac/permission.service"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { USER_TYPE_SERVICE } from "@/domains/users/user.types"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AppsModule } from "../apps.module"
import {
  INSTALL_PKCE_METHOD_S256,
  RFC7636_TEST_CODE_CHALLENGE,
  RFC7636_TEST_CODE_VERIFIER,
} from "../install-pkce"

describe("Apps - Install", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let authSubject = `oidc|${randomUUID()}`
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AppsModule, RbacModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(
          withDocumentEmbeddingsBatchServiceMock(moduleBuilder),
          () => authSubject,
        ),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const postExchange = (body: { code: string; redirect_uri: string; code_verifier: string }) =>
    supertest(app.getHttpServer())
      .post(AppsV1Routes.exchangeInstallCode.getPath())
      .set("Connection", "close")
      .send(body)

  const createStaffInstaller = async () => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    await assignPlatformStaffToUser({ repositories, user })
    return { organization, project, user }
  }

  const createManifest = async (token = "token") => {
    const superadminAuthSubject = `oidc|${randomUUID()}`
    const previousAuthSubject = authSubject
    authSubject = superadminAuthSubject
    const { user } = await createOrganizationWithProject(repositories, {
      user: {
        authSubject: superadminAuthSubject,
        email: mockOidcEmailForSub(superadminAuthSubject),
      },
    })
    await assignPlatformSuperadminToUser({ repositories, user })
    const created = await request({
      route: AppsRoutes.createOne,
      token,
      request: {
        payload: {
          name: "Helpful Assistant",
          slug: "helpful-assistant",
          description: null,
          logoUrl: null,
          grantablePermissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
        },
      },
    })
    expectResponse(created, 201)
    authSubject = previousAuthSubject
    return created.body.data
  }

  describe("AppsRoutes.getInstall", () => {
    it("requires an authentication token", async () => {
      expectResponse(
        await request({
          route: AppsRoutes.getInstall,
          pathParams: { slug: "helpful-assistant" },
        }),
        401,
        AUTH_ERRORS.NO_ACCESS_TOKEN,
      )
    })

    it("rejects users without app.install", async () => {
      await createOrganizationWithProject(repositories, {
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      expectResponse(
        await request({
          route: AppsRoutes.getInstall,
          pathParams: { slug: "helpful-assistant" },
          token: "token",
        }),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })

    it("returns the app and back-office-visible projects for staff", async () => {
      const { project } = await createStaffInstaller()
      const manifest = await createManifest()

      const response = await request({
        route: AppsRoutes.getInstall,
        pathParams: { slug: manifest.slug },
        token: "token",
      })
      expectResponse(response, 200)
      expect(response.body.data.app).toMatchObject({
        name: "Helpful Assistant",
        slug: "helpful-assistant",
        grantablePermissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
        allowedRedirectUris: [],
      })
      expect(response.body.data.projects.map((installProject) => installProject.id)).toContain(
        project.id,
      )
    })
  })

  describe("AppsRoutes.authorize", () => {
    const redirectUri = "http://127.0.0.1:8787/callback"

    it("creates credentials once and refuses a second active install", async () => {
      const { project, user } = await createStaffInstaller()
      const manifest = await createManifest()

      const authorized = await request({
        route: AppsRoutes.authorize,
        pathParams: { slug: manifest.slug },
        token: "token",
        request: {
          payload: {
            projectId: project.id,
            permissions: [DOCUMENT_READ_PERMISSION],
            redirectUri,
            state: "csrf-state",
            codeChallenge: RFC7636_TEST_CODE_CHALLENGE,
            codeChallengeMethod: INSTALL_PKCE_METHOD_S256,
          },
        },
      })
      expectResponse(authorized, 201)
      expect(authorized.body.data.code).toBeTruthy()
      expect(authorized.body.data.state).toBe("csrf-state")
      expect(authorized.body.data).not.toHaveProperty("clientId")
      expect(authorized.body.data).not.toHaveProperty("clientSecret")

      const exchanged = await postExchange({
        code: authorized.body.data.code,
        redirect_uri: redirectUri,
        code_verifier: RFC7636_TEST_CODE_VERIFIER,
      })
      expectResponse(exchanged, 200)
      expect(exchanged.body.client_id).toBeTruthy()
      expect(exchanged.body.client_secret).toBeTruthy()

      const reused = await postExchange({
        code: authorized.body.data.code,
        redirect_uri: redirectUri,
        code_verifier: RFC7636_TEST_CODE_VERIFIER,
      })
      expectResponse(reused, 401)

      const installation = await repositories.appInstallationRepository.findOneByOrFail({
        clientId: exchanged.body.client_id,
      })
      expect(installation.clientSecretHash).not.toContain(exchanged.body.client_secret)
      const serviceUser = await repositories.userRepository.findOneByOrFail({
        id: installation.serviceUserId ?? undefined,
      })
      expect(serviceUser.type).toBe(USER_TYPE_SERVICE)
      await expectActivityCreated("appInstallation.authorize", {
        userId: user.id,
        organizationId: project.organizationId,
        projectId: project.id,
        entityId: installation.id,
        entityType: "appInstallation",
      })

      const permissionService = setup.module.get(PermissionService)
      await expect(
        permissionService.has(serviceUser.id, DOCUMENT_READ_PERMISSION, {
          type: "project",
          id: project.id,
        }),
      ).resolves.toBe(true)

      const conflict = await request({
        route: AppsRoutes.authorize,
        pathParams: { slug: manifest.slug },
        token: "token",
        request: {
          payload: {
            projectId: project.id,
            permissions: [DOCUMENT_READ_PERMISSION],
            redirectUri,
            state: "csrf-state",
            codeChallenge: RFC7636_TEST_CODE_CHALLENGE,
            codeChallengeMethod: INSTALL_PKCE_METHOD_S256,
          },
        },
      })
      expectResponse(conflict, 409)

      await repositories.appInstallationRepository.update(
        { id: installation.id },
        { status: APP_INSTALLATION_STATUS_REVOKED, revokedAt: new Date() },
      )

      const reinstall = await request({
        route: AppsRoutes.authorize,
        pathParams: { slug: manifest.slug },
        token: "token",
        request: {
          payload: {
            projectId: project.id,
            permissions: [DOCUMENT_READ_PERMISSION],
            redirectUri,
            state: "csrf-state-2",
            codeChallenge: RFC7636_TEST_CODE_CHALLENGE,
            codeChallengeMethod: INSTALL_PKCE_METHOD_S256,
          },
        },
      })
      expectResponse(reinstall, 201)
      expect(reinstall.body.data.code).toBeTruthy()
      expect(reinstall.body.data.code).not.toBe(authorized.body.data.code)
    })

    it("rejects a non-loopback redirect URI that is not allowlisted", async () => {
      const { project } = await createStaffInstaller()
      const manifest = await createManifest()
      expectResponse(
        await request({
          route: AppsRoutes.authorize,
          pathParams: { slug: manifest.slug },
          token: "token",
          request: {
            payload: {
              projectId: project.id,
              permissions: [DOCUMENT_READ_PERMISSION],
              redirectUri: "https://evil.example/callback",
              state: "csrf-state",
              codeChallenge: RFC7636_TEST_CODE_CHALLENGE,
              codeChallengeMethod: INSTALL_PKCE_METHOD_S256,
            },
          },
        }),
        400,
        "redirectUri must be a registered https callback URL for this app, or a loopback http(s) URL (localhost, *.localhost, 127.0.0.1, or ::1)",
      )
    })

    it("accepts an allowlisted HTTPS redirect URI", async () => {
      const { project } = await createStaffInstaller()
      const registeredRedirectUri = "https://site-crawler.staging.bayes.org/auth/bayes/callback"
      const superadminAuthSubject = `oidc|${randomUUID()}`
      const previousAuthSubject = authSubject
      authSubject = superadminAuthSubject
      const { user } = await createOrganizationWithProject(repositories, {
        user: {
          authSubject: superadminAuthSubject,
          email: mockOidcEmailForSub(superadminAuthSubject),
        },
      })
      await assignPlatformSuperadminToUser({ repositories, user })
      const created = await request({
        route: AppsRoutes.createOne,
        token: "token",
        request: {
          payload: {
            name: "Site Crawler",
            slug: "site-crawler",
            description: null,
            logoUrl: null,
            grantablePermissions: [DOCUMENT_READ_PERMISSION],
            allowedRedirectUris: [registeredRedirectUri],
          },
        },
      })
      expectResponse(created, 201)
      authSubject = previousAuthSubject

      const authorized = await request({
        route: AppsRoutes.authorize,
        pathParams: { slug: created.body.data.slug },
        token: "token",
        request: {
          payload: {
            projectId: project.id,
            permissions: [DOCUMENT_READ_PERMISSION],
            redirectUri: registeredRedirectUri,
            state: "csrf-state",
            codeChallenge: RFC7636_TEST_CODE_CHALLENGE,
            codeChallengeMethod: INSTALL_PKCE_METHOD_S256,
          },
        },
      })
      expectResponse(authorized, 201)
      expect(authorized.body.data.redirectUri).toBe(registeredRedirectUri)
      expect(authorized.body.data.code).toBeTruthy()
      expect(authorized.body.data).not.toHaveProperty("clientSecret")

      const exchanged = await postExchange({
        code: authorized.body.data.code,
        redirect_uri: registeredRedirectUri,
        code_verifier: RFC7636_TEST_CODE_VERIFIER,
      })
      expectResponse(exchanged, 200)
      expect(exchanged.body.client_id).toBeTruthy()
      expect(exchanged.body.client_secret).toBeTruthy()
    })
  })
})

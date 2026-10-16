import { randomUUID } from "node:crypto"
import {
  AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
  AppsRoutes,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_TAG_READ_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { configureGlobalPrefix } from "@/config/api-prefix"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import {
  APP_INSTALLATION_STATUS_ACTIVE,
  APP_INSTALLATION_STATUS_REVOKED,
} from "@/domains/apps/app-installation.entity"
import { appManifestFactory } from "@/domains/apps/app-manifest.factory"
import { AppsService } from "@/domains/apps/apps.service"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { USER_TYPE_SERVICE } from "@/domains/users/user.types"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { OAuthModule } from "../oauth.module"
import { APP_REFRESH_TOKEN_TTL_MS } from "../oauth-authorization.service"
import { OAuthClientsService } from "../oauth-clients.service"
import { OAuthGrant } from "../oauth-grant.entity"
import { OAuthRefreshToken } from "../oauth-refresh-token.entity"
import {
  buildAuthorizationRequest,
  generatePkcePair,
  obtainTokens,
  resetRateLimits,
  TEST_REDIRECT_URI,
} from "./oauth-test.helpers"

const DAY_MS = 24 * 60 * 60 * 1000

describe("OAuth authorization server - app installs", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let authSubject = "oidc|123"
  let baseUrl: string

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [OAuthModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(
          withDocumentEmbeddingsBatchServiceMock(moduleBuilder),
          () => authSubject,
        ),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    configureGlobalPrefix(app)
    await app.listen(0, "127.0.0.1")
    baseUrl = await app.getUrl()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    resetRateLimits(app)
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (role: "owner" | "member" = "owner") => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      organizationMembership: { role },
      projectMembership: { role },
    })
    authSubject = user.authSubject!
    return { user, organization, project }
  }

  /** A manifest and its OAuth client, as the back-office sets them up. */
  const createAppClient = async (
    grantablePermissions: string[] = [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
  ) => {
    const manifest = appManifestFactory.build({ grantablePermissions })
    await repositories.appManifestRepository.save(manifest)
    const credentials = await app.get(OAuthClientsService).createAppClientSecret(manifest.id)
    return { manifest, ...credentials }
  }

  const getConsent = (clientId: string) =>
    request(baseUrl)
      .get("/api/oauth/consent")
      .set("Authorization", "Bearer token")
      .query(
        buildAuthorizationRequest({ clientId, codeChallenge: generatePkcePair().codeChallenge }),
      )

  const postConsent = (params: {
    clientId: string
    codeChallenge: string
    projectIds: string[]
    permissions: string[]
  }) =>
    request(baseUrl)
      .post("/api/oauth/consent")
      .set("Authorization", "Bearer token")
      .send({
        payload: {
          ...buildAuthorizationRequest(params),
          projectIds: params.projectIds,
          permissions: params.permissions,
        },
      })

  const basicAuth = (clientId: string, clientSecret: string) =>
    `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64")}`

  /** Installs the app on the project as the signed-in person, and exchanges the code. */
  const installApp = async (params: {
    clientId: string
    clientSecret: string
    projectId: string
    permissions?: string[]
  }) => {
    const { codeVerifier, codeChallenge } = generatePkcePair()
    const consent = await postConsent({
      clientId: params.clientId,
      codeChallenge,
      projectIds: [params.projectId],
      permissions: params.permissions ?? [DOCUMENT_READ_PERMISSION],
    })
    expect(consent.status).toBe(201)
    const code = new URL(consent.body.data.redirectTo).searchParams.get("code")
    const response = await request(baseUrl)
      .post("/api/oauth/token")
      .set("Authorization", basicAuth(params.clientId, params.clientSecret))
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        redirect_uri: TEST_REDIRECT_URI,
        code_verifier: codeVerifier,
      })
    expect(response.status).toBe(200)
    return {
      accessToken: response.body.access_token as string,
      refreshToken: response.body.refresh_token as string,
      expiresIn: response.body.expires_in as number,
    }
  }

  const refresh = (params: { clientId: string; clientSecret: string; refreshToken: string }) =>
    request(baseUrl).post("/api/oauth/token").type("form").send({
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    })

  const getAppsMe = (accessToken: string) =>
    request(baseUrl).get("/api/apps/v1/me").set("Authorization", `Bearer ${accessToken}`)

  describe("the app's client in the back-office", () => {
    const signInAsSuperadmin = async () => {
      const { user } = await createContext()
      await assignPlatformSuperadminToUser({ repositories, user })
    }

    it("creates the client with a secret shown once, then replaces the secret", async () => {
      await signInAsSuperadmin()
      const manifest = appManifestFactory.build()
      await repositories.appManifestRepository.save(manifest)
      const secretPath = `/api${AppsRoutes.createOAuthClientSecret.getPath({ appManifestId: manifest.id })}`
      const clientPath = `/api${AppsRoutes.getOAuthClient.getPath({ appManifestId: manifest.id })}`

      const before = await request(baseUrl).get(clientPath).set("Authorization", "Bearer token")
      const created = await request(baseUrl).post(secretPath).set("Authorization", "Bearer token")
      const rotated = await request(baseUrl).post(secretPath).set("Authorization", "Bearer token")
      const after = await request(baseUrl).get(clientPath).set("Authorization", "Bearer token")

      expect(before.body.data).toEqual({
        clientId: null,
        issuer: `${baseUrl}/api/oauth`,
        authorizationEndpoint: expect.stringMatching(/\/oauth\/authorize$/),
        resource: `${baseUrl}/api/apps/v1`,
      })
      expect(created.status).toBe(201)
      expect(created.body.data).toEqual({
        clientId: expect.stringMatching(/^app_/),
        clientSecret: expect.any(String),
      })
      expect(rotated.body.data.clientId).toBe(created.body.data.clientId)
      expect(rotated.body.data.clientSecret).not.toBe(created.body.data.clientSecret)
      expect(after.body.data.clientId).toBe(created.body.data.clientId)
      const clientsService = app.get(OAuthClientsService)
      await expect(
        clientsService.verifyAppClientSecret(
          created.body.data.clientId,
          created.body.data.clientSecret,
        ),
      ).resolves.toBe(false)
      await expect(
        clientsService.verifyAppClientSecret(
          created.body.data.clientId,
          rotated.body.data.clientSecret,
        ),
      ).resolves.toBe(true)
    })

    it("is reserved to the people who manage apps", async () => {
      await createContext()
      const manifest = appManifestFactory.build()
      await repositories.appManifestRepository.save(manifest)

      const response = await request(baseUrl)
        .post(`/api${AppsRoutes.createOAuthClientSecret.getPath({ appManifestId: manifest.id })}`)
        .set("Authorization", "Bearer token")

      expect(response.status).toBe(403)
    })
  })

  describe("consent", () => {
    it("shows the app with the projects the person can install it on", async () => {
      const { project } = await createContext()
      const appPermissions = [
        DOCUMENT_READ_PERMISSION,
        AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
      ]
      const { clientId, manifest } = await createAppClient(appPermissions)

      const response = await getConsent(clientId)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        client: { clientId, kind: "app", name: manifest.name, verified: true },
        grantablePermissions: appPermissions,
        projects: [{ id: project.id, availablePermissions: appPermissions }],
      })
    })

    it("offers no project to a project member", async () => {
      await createContext("member")
      const { clientId } = await createAppClient()

      const response = await getConsent(clientId)

      expect(response.status).toBe(200)
      expect(response.body.data.projects).toEqual([])
    })

    it("refuses a project member, several projects, or a permission the app does not offer", async () => {
      const { project } = await createContext()
      const { project: otherProject } = await createOrganizationWithProject(repositories)
      const { clientId } = await createAppClient()
      const { codeChallenge } = generatePkcePair()

      const notAllowed = await postConsent({
        clientId,
        codeChallenge,
        projectIds: [otherProject.id],
        permissions: [DOCUMENT_READ_PERMISSION],
      })
      const twoProjects = await postConsent({
        clientId,
        codeChallenge,
        projectIds: [project.id, otherProject.id],
        permissions: [DOCUMENT_READ_PERMISSION],
      })
      const notOffered = await postConsent({
        clientId,
        codeChallenge,
        projectIds: [project.id],
        permissions: [DOCUMENT_TAG_READ_PERMISSION],
      })

      expect(notAllowed.status).toBe(404)
      expect(twoProjects.status).toBe(400)
      expect(notOffered.status).toBe(400)
      expect(await repositories.appInstallationRepository.count()).toBe(0)
    })

    it("reconnects an app already installed on the project, keeping its installation", async () => {
      const { project } = await createContext()
      const { clientId, clientSecret, manifest } = await createAppClient()
      const first = await installApp({ clientId, clientSecret, projectId: project.id })
      const installation = await repositories.appInstallationRepository.findOneByOrFail({
        appManifestId: manifest.id,
      })

      const second = await installApp({
        clientId,
        clientSecret,
        projectId: project.id,
        permissions: [DOCUMENT_READ_PERMISSION, DOCUMENT_CREATE_PERMISSION],
      })

      const installations = await repositories.appInstallationRepository.findBy({
        appManifestId: manifest.id,
      })
      expect(installations.map((row) => row.id)).toEqual([installation.id])
      const me = await getAppsMe(second.accessToken)
      expect(me.body.data).toMatchObject({
        installationId: installation.id,
        userId: installation.serviceUserId,
      })
      // The grant of the first connection ends with it.
      const stale = await refresh({ clientId, clientSecret, refreshToken: first.refreshToken })
      expect(stale.status).toBe(400)
      expect((await getAppsMe(second.accessToken)).status).toBe(200)
    })
  })

  describe("install", () => {
    it("installs the app as its own service user, with the permissions granted", async () => {
      const { project, user } = await createContext()
      const { clientId, clientSecret, manifest } = await createAppClient()

      const tokens = await installApp({ clientId, clientSecret, projectId: project.id })

      expect(tokens.expiresIn).toBe(3600)
      const installation = await repositories.appInstallationRepository.findOneByOrFail({
        appManifestId: manifest.id,
      })
      expect(installation).toMatchObject({
        projectId: project.id,
        status: APP_INSTALLATION_STATUS_ACTIVE,
        createdByUserId: user.id,
      })
      const me = await getAppsMe(tokens.accessToken)
      expect(me.status).toBe(200)
      expect(me.body.data).toMatchObject({
        userId: installation.serviceUserId,
        projectId: project.id,
        installationId: installation.id,
      })
      const serviceUser = await repositories.userRepository.findOneByOrFail({
        id: installation.serviceUserId!,
      })
      expect(serviceUser.type).toBe(USER_TYPE_SERVICE)
      const grant = await setup.dataSource
        .getRepository(OAuthGrant)
        .findOneByOrFail({ appInstallationId: installation.id })
      // The grant belongs to no person: it outlives its installer's account.
      expect(grant.userId).toBeNull()
    })

    it("leaves the install out of the person's connected apps", async () => {
      const { project } = await createContext()
      const { clientId, clientSecret } = await createAppClient()
      await installApp({ clientId, clientSecret, projectId: project.id })

      const grants = await request(baseUrl)
        .get("/api/oauth/grants")
        .set("Authorization", "Bearer token")

      expect(grants.body.data).toEqual([])
    })
  })

  describe("client authentication", () => {
    /** Approves an install, then exchanges its code with the given client authentication. */
    const exchangeWith = async (
      authentication: (credentials: { clientId: string; clientSecret: string }) => {
        authorization?: string
        body?: Record<string, string>
      },
    ) => {
      const { project } = await createContext()
      const credentials = await createAppClient()
      const { codeVerifier, codeChallenge } = generatePkcePair()
      const consent = await postConsent({
        clientId: credentials.clientId,
        codeChallenge,
        projectIds: [project.id],
        permissions: [DOCUMENT_READ_PERMISSION],
      })
      const code = new URL(consent.body.data.redirectTo).searchParams.get("code")
      const { authorization, body } = authentication(credentials)
      const call = request(baseUrl).post("/api/oauth/token").type("form")
      if (authorization) call.set("Authorization", authorization)
      return call.send({
        grant_type: "authorization_code",
        code,
        redirect_uri: TEST_REDIRECT_URI,
        code_verifier: codeVerifier,
        ...body,
      })
    }

    it("accepts the secret in the body", async () => {
      const response = await exchangeWith(({ clientId, clientSecret }) => ({
        body: { client_id: clientId, client_secret: clientSecret },
      }))

      expect(response.status).toBe(200)
    })

    it("refuses a missing or wrong secret", async () => {
      const withoutSecret = await exchangeWith(({ clientId }) => ({
        body: { client_id: clientId },
      }))
      const wrongSecret = await exchangeWith(({ clientId }) => ({
        authorization: basicAuth(clientId, "not-the-secret"),
      }))

      expect(withoutSecret.status).toBe(401)
      expect(withoutSecret.body.error).toBe("invalid_client")
      expect(wrongSecret.status).toBe(401)
      expect(wrongSecret.body.error).toBe("invalid_client")
    })
  })

  describe("refresh", () => {
    it("rotates the refresh token, which lives 90 days from its last use", async () => {
      const { project } = await createContext()
      const { clientId, clientSecret } = await createAppClient()
      const tokens = await installApp({ clientId, clientSecret, projectId: project.id })

      const response = await refresh({ clientId, clientSecret, refreshToken: tokens.refreshToken })

      expect(response.status).toBe(200)
      expect(response.body.refresh_token).not.toBe(tokens.refreshToken)
      expect((await getAppsMe(response.body.access_token)).status).toBe(200)
      const latest = await setup.dataSource.getRepository(OAuthRefreshToken).findOneOrFail({
        where: {},
        order: { createdAt: "DESC" },
      })
      expect(latest.expiresAt.getTime()).toBeGreaterThan(
        Date.now() + APP_REFRESH_TOKEN_TTL_MS - DAY_MS,
      )
    })

    it("cuts the grant when a refresh token comes back, and a reconnection restores it", async () => {
      const { project } = await createContext()
      const { clientId, clientSecret, manifest } = await createAppClient()
      const tokens = await installApp({ clientId, clientSecret, projectId: project.id })
      const rotated = await refresh({ clientId, clientSecret, refreshToken: tokens.refreshToken })

      const replay = await refresh({ clientId, clientSecret, refreshToken: tokens.refreshToken })

      expect(replay.status).toBe(400)
      expect(replay.body.error).toBe("invalid_grant")
      // Every token of the grant stops at once, the rotated one included.
      expect((await getAppsMe(rotated.body.access_token)).status).toBe(401)
      const next = await refresh({
        clientId,
        clientSecret,
        refreshToken: rotated.body.refresh_token,
      })
      expect(next.status).toBe(400)
      // The installation stays, with what is tied to it.
      const installation = await repositories.appInstallationRepository.findOneByOrFail({
        appManifestId: manifest.id,
      })
      expect(installation.status).toBe(APP_INSTALLATION_STATUS_ACTIVE)

      const reconnected = await installApp({ clientId, clientSecret, projectId: project.id })

      const me = await getAppsMe(reconnected.accessToken)
      expect(me.status).toBe(200)
      expect(me.body.data.installationId).toBe(installation.id)
    })
  })

  describe("revocation", () => {
    it("stops the app at once when the installation is revoked in the studio", async () => {
      const { project, user } = await createContext()
      const { clientId, clientSecret, manifest } = await createAppClient()
      const tokens = await installApp({ clientId, clientSecret, projectId: project.id })
      const installation = await repositories.appInstallationRepository.findOneByOrFail({
        appManifestId: manifest.id,
      })

      await app.get(AppsService).revokeInstallation({
        installationId: installation.id,
        userId: user.id,
        projectId: project.id,
      })

      expect((await getAppsMe(tokens.accessToken)).status).toBe(401)
      const refreshed = await refresh({ clientId, clientSecret, refreshToken: tokens.refreshToken })
      expect(refreshed.status).toBe(400)
      expect(refreshed.body.error).toBe("invalid_grant")
    })

    it("revokes the installation with the refresh token (RFC 7009)", async () => {
      const { project } = await createContext()
      const { clientId, clientSecret, manifest } = await createAppClient()
      const tokens = await installApp({ clientId, clientSecret, projectId: project.id })

      const response = await request(baseUrl)
        .post("/api/oauth/revoke")
        .set("Authorization", basicAuth(clientId, clientSecret))
        .type("form")
        .send({ token: tokens.refreshToken })

      expect(response.status).toBe(200)
      const installation = await repositories.appInstallationRepository.findOneByOrFail({
        appManifestId: manifest.id,
      })
      expect(installation.status).toBe(APP_INSTALLATION_STATUS_REVOKED)
    })
  })

  describe("audiences", () => {
    it("refuses an MCP client's token on the apps API", async () => {
      const { project } = await createContext()
      const { accessToken } = await obtainTokens(baseUrl, {
        projectIds: [project.id],
        permissions: ["project.read"],
      })

      expect((await getAppsMe(accessToken)).status).toBe(401)
    })

    it("refuses an unknown client id", async () => {
      await createContext()

      const response = await getConsent(`app_${randomUUID().replaceAll("-", "")}`)

      expect(response.status).toBe(400)
    })
  })
})

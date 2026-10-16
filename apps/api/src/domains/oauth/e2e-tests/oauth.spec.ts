import { afterAll } from "@jest/globals"
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { ClientMetadataDocumentFetcher } from "../client-metadata-document.fetcher"
import { OAuthModule } from "../oauth.module"
import {
  approveConsent,
  buildAuthorizationRequest,
  exchangeCode,
  generatePkcePair,
  obtainTokens,
  registerTestClient,
  resetRateLimits,
  TEST_REDIRECT_URI,
} from "./oauth-test.helpers"

const CIMD_CLIENT_ID = "https://client.example.org/oauth/client.json"

describe("OAuth authorization server", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let authSubject = "oidc|123"
  let clientMetadataDocument: unknown = null
  let baseUrl: string

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [OAuthModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(ClientMetadataDocumentFetcher)
          .useValue({ fetchDocument: async () => clientMetadataDocument }),
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
    clientMetadataDocument = {
      client_id: CIMD_CLIENT_ID,
      client_name: "Helpful Client",
      redirect_uris: [TEST_REDIRECT_URI],
    }
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const server = () => baseUrl

  const createContext = async (role: "owner" | "member" = "owner") => {
    const { user, organization, project } = await createOrganizationWithProject(repositories, {
      organizationMembership: { role },
      projectMembership: { role },
    })
    authSubject = user.authSubject!
    return { user, organization, project }
  }

  const getConsent = (query: Record<string, string>) =>
    request(server()).get("/api/oauth/consent").set("Authorization", "Bearer token").query(query)

  describe("metadata", () => {
    it("serves the RFC 8414 document at the issuer's well-known path", async () => {
      const response = await request(server()).get(
        "/.well-known/oauth-authorization-server/api/oauth",
      )

      expect(response.status).toBe(200)
      const issuer = `${response.request.url.split("/.well-known")[0]}/api/oauth`
      expect(response.body).toMatchObject({
        issuer,
        token_endpoint: `${issuer}/token`,
        registration_endpoint: `${issuer}/register`,
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: [
          "none",
          "client_secret_basic",
          "client_secret_post",
        ],
        client_id_metadata_document_supported: true,
      })
    })
  })

  describe("registration", () => {
    it("registers a public client", async () => {
      const response = await request(server())
        .post("/api/oauth/register")
        .send({ redirect_uris: [TEST_REDIRECT_URI], client_name: "Helpful Client" })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        client_id: expect.stringMatching(/^dcr_/),
        token_endpoint_auth_method: "none",
        redirect_uris: [TEST_REDIRECT_URI],
      })
    })

    it("accepts the custom scheme of a native app, refuses a script scheme", async () => {
      const register = (redirectUri: string) =>
        request(server())
          .post("/api/oauth/register")
          .send({ redirect_uris: [redirectUri] })

      const nativeApp = await register("claude://claude.ai/mcp-auth-callback/sdk")
      const reverseDomain = await register("com.example.app:/oauth/callback")
      const script = await register("javascript:alert(1)")

      expect(nativeApp.status).toBe(201)
      expect(reverseDomain.status).toBe(201)
      expect(script.status).toBe(400)
    })

    it("refuses a plain http redirect URI outside loopback", async () => {
      const response = await request(server())
        .post("/api/oauth/register")
        .send({ redirect_uris: ["http://client.example.org/callback"] })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("invalid_client_metadata")
    })

    it("deletes the clients nobody approved within a day when a new one registers", async () => {
      const { project } = await createContext()
      const unusedClientId = await registerTestClient(baseUrl)
      const { clientId: usedClientId } = await obtainTokens(baseUrl, {
        projectIds: [project.id],
        permissions: ["project.read"],
      })
      const dayAndHourAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
      await repositories.oauthClientRepository.update(
        { registrationType: "dcr" },
        { createdAt: dayAndHourAgo },
      )

      await registerTestClient(baseUrl)

      const remainingClientIds = (await repositories.oauthClientRepository.find()).map(
        (client) => client.clientId,
      )
      expect(remainingClientIds).not.toContain(unusedClientId)
      expect(remainingClientIds).toContain(usedClientId)
    })

    it("limits registrations per IP", async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        await registerTestClient(baseUrl)
      }
      const response = await request(server())
        .post("/api/oauth/register")
        .send({ redirect_uris: [TEST_REDIRECT_URI] })

      expect(response.status).toBe(429)
    })
  })

  describe("consent page", () => {
    it("describes an unverified dcr client and the projects to grant", async () => {
      const { organization, project } = await createContext()
      const clientId = await registerTestClient(baseUrl)

      const response = await getConsent(
        buildAuthorizationRequest({ clientId, codeChallenge: generatePkcePair().codeChallenge }),
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        client: {
          clientId,
          kind: "mcp",
          name: "Helpful Client",
          redirectHost: "127.0.0.1:4567",
          verified: false,
          description: null,
          logoUrl: null,
        },
        projects: [
          {
            id: project.id,
            name: project.name,
            organizationId: organization.id,
            organizationName: organization.name,
            availablePermissions: ["project.read", "agent.create", "agent.settings.draft.update"],
          },
        ],
        grantablePermissions: ["project.read", "agent.create", "agent.settings.draft.update"],
      })
    })

    it("offers a project member only what they hold", async () => {
      await createContext("member")
      const clientId = await registerTestClient(baseUrl)

      const response = await getConsent(
        buildAuthorizationRequest({ clientId, codeChallenge: generatePkcePair().codeChallenge }),
      )

      expect(response.body.data.projects[0].availablePermissions).toEqual([
        "project.read",
        "agent.settings.draft.update",
      ])
    })

    it("marks a metadata document client as verified", async () => {
      await createContext()

      const response = await getConsent(
        buildAuthorizationRequest({
          clientId: CIMD_CLIENT_ID,
          codeChallenge: generatePkcePair().codeChallenge,
        }),
      )

      expect(response.status).toBe(200)
      expect(response.body.data.client).toMatchObject({ clientId: CIMD_CLIENT_ID, verified: true })
    })

    it("refuses a metadata document that names another client", async () => {
      await createContext()
      clientMetadataDocument = {
        client_id: "https://other.example.org/client.json",
        redirect_uris: [TEST_REDIRECT_URI],
      }

      const response = await getConsent(
        buildAuthorizationRequest({
          clientId: CIMD_CLIENT_ID,
          codeChallenge: generatePkcePair().codeChallenge,
        }),
      )

      expect(response.status).toBe(400)
    })

    it("accepts another loopback port, refuses another redirect URI", async () => {
      await createContext()
      const clientId = await registerTestClient(baseUrl)
      const { codeChallenge } = generatePkcePair()

      const otherPort = await getConsent(
        buildAuthorizationRequest({
          clientId,
          codeChallenge,
          redirectUri: "http://127.0.0.1:9999/callback",
        }),
      )
      const otherPath = await getConsent(
        buildAuthorizationRequest({
          clientId,
          codeChallenge,
          redirectUri: "http://127.0.0.1:4567/elsewhere",
        }),
      )

      expect(otherPort.status).toBe(200)
      expect(otherPath.status).toBe(400)
    })

    it("refuses an unknown client and requires a signed-in person", async () => {
      await createContext()
      const query = buildAuthorizationRequest({
        clientId: "dcr_unknown",
        codeChallenge: generatePkcePair().codeChallenge,
      })

      expect((await getConsent(query)).status).toBe(400)
      expect((await request(server()).get("/api/oauth/consent").query(query)).status).toBe(401)
    })

    it("refuses a project the person cannot see", async () => {
      await createContext()
      const { project: otherProject } = await createOrganizationWithProject(repositories)
      const clientId = await registerTestClient(baseUrl)

      const response = await request(server())
        .post("/api/oauth/consent")
        .set("Authorization", "Bearer token")
        .send({
          payload: {
            ...buildAuthorizationRequest({
              clientId,
              codeChallenge: generatePkcePair().codeChallenge,
            }),
            projectIds: [otherProject.id],
            permissions: ["project.read"],
          },
        })

      expect(response.status).toBe(404)
    })

    it("sends the code, the state and the issuer back to the client", async () => {
      const { project } = await createContext()
      const clientId = await registerTestClient(baseUrl)

      const response = await request(server())
        .post("/api/oauth/consent")
        .set("Authorization", "Bearer token")
        .send({
          payload: {
            ...buildAuthorizationRequest({
              clientId,
              codeChallenge: generatePkcePair().codeChallenge,
            }),
            projectIds: [project.id],
            permissions: ["project.read"],
          },
        })

      const redirect = new URL(response.body.data.redirectTo)
      expect(`${redirect.origin}${redirect.pathname}`).toBe(TEST_REDIRECT_URI)
      expect(redirect.searchParams.get("code")).toBeTruthy()
      expect(redirect.searchParams.get("state")).toBe("state-123")
      expect(redirect.searchParams.get("iss")).toMatch(/\/api\/oauth$/)
    })
  })

  describe("token endpoint", () => {
    it("exchanges a code for an access token and a refresh token", async () => {
      const { project } = await createContext()
      const clientId = await registerTestClient(baseUrl)
      const { codeVerifier, codeChallenge } = generatePkcePair()
      const code = await approveConsent(baseUrl, {
        clientId,
        codeChallenge,
        projectIds: [project.id],
        permissions: ["project.read", "agent.create"],
      })

      const response = await exchangeCode(baseUrl, { clientId, code, codeVerifier })

      expect(response.status).toBe(200)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.body).toMatchObject({
        token_type: "Bearer",
        expires_in: 900,
        scope: "project.read agent.create",
      })
      const [header, payload] = response.body.access_token.split(".")
      expect(JSON.parse(Buffer.from(header, "base64url").toString())).toMatchObject({
        typ: "at+jwt",
      })
      expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toMatchObject({
        aud: expect.stringMatching(/\/api\/mcp$/),
        client_id: clientId,
      })
    })

    it("refuses a wrong verifier, a reused code and another client", async () => {
      const { project } = await createContext()
      const clientId = await registerTestClient(baseUrl)
      const otherClientId = await registerTestClient(baseUrl)
      const { codeVerifier, codeChallenge } = generatePkcePair()
      const code = await approveConsent(baseUrl, {
        clientId,
        codeChallenge,
        projectIds: [project.id],
        permissions: ["project.read"],
      })

      const wrongVerifier = await exchangeCode(baseUrl, {
        clientId,
        code,
        codeVerifier: generatePkcePair().codeVerifier,
      })
      const otherClient = await exchangeCode(baseUrl, {
        clientId: otherClientId,
        code,
        codeVerifier,
      })
      const firstUse = await exchangeCode(baseUrl, { clientId, code, codeVerifier })
      const secondUse = await exchangeCode(baseUrl, { clientId, code, codeVerifier })

      expect(wrongVerifier.body.error).toBe("invalid_grant")
      expect(otherClient.body.error).toBe("invalid_grant")
      expect(firstUse.status).toBe(200)
      expect(secondUse.status).toBe(400)
      expect(secondUse.body.error).toBe("invalid_grant")
    })

    it("refuses an unsupported grant type", async () => {
      const response = await request(server())
        .post("/api/oauth/token")
        .type("form")
        .send({ grant_type: "password", client_id: "dcr_x" })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe("unsupported_grant_type")
    })

    it("rotates refresh tokens and revokes the grant when an old one comes back", async () => {
      const { project } = await createContext()
      const { clientId, refreshToken } = await obtainTokens(baseUrl, {
        projectIds: [project.id],
        permissions: ["project.read"],
      })
      const refresh = (token: string) =>
        request(server())
          .post("/api/oauth/token")
          .type("form")
          .send({ grant_type: "refresh_token", refresh_token: token, client_id: clientId })

      const rotated = await refresh(refreshToken)
      const replayed = await refresh(refreshToken)
      const afterReplay = await refresh(rotated.body.refresh_token)

      expect(rotated.status).toBe(200)
      expect(rotated.body.refresh_token).not.toBe(refreshToken)
      expect(replayed.body.error).toBe("invalid_grant")
      expect(afterReplay.body.error).toBe("invalid_grant")
    })

    it("revokes the grant of a revoked refresh token", async () => {
      const { project } = await createContext()
      const { clientId, refreshToken } = await obtainTokens(baseUrl, {
        projectIds: [project.id],
        permissions: ["project.read"],
      })

      const revocation = await request(server())
        .post("/api/oauth/revoke")
        .type("form")
        .send({ token: refreshToken, client_id: clientId })
      const refresh = await request(server())
        .post("/api/oauth/token")
        .type("form")
        .send({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId })

      expect(revocation.status).toBe(200)
      expect(refresh.body.error).toBe("invalid_grant")
    })
  })

  describe("grants", () => {
    it("lists and revokes the person's grants, not someone else's", async () => {
      const { project } = await createContext()
      await obtainTokens(baseUrl, { projectIds: [project.id], permissions: ["project.read"] })
      const listGrants = () =>
        request(server()).get("/api/oauth/grants").set("Authorization", "Bearer token")

      const [grant] = (await listGrants()).body.data
      expect(grant).toMatchObject({
        client: { name: "Helpful Client", verified: false },
        projects: [{ id: project.id, name: project.name }],
        permissions: ["project.read"],
      })

      const ownerSubject = authSubject
      await createContext()
      const byOtherUser = await request(server())
        .delete(`/api/oauth/grants/${grant.id}`)
        .set("Authorization", "Bearer token")
      authSubject = ownerSubject
      const byOwner = await request(server())
        .delete(`/api/oauth/grants/${grant.id}`)
        .set("Authorization", "Bearer token")

      expect(byOtherUser.status).toBe(404)
      expect(byOwner.status).toBe(200)
      expect((await listGrants()).body.data).toEqual([])
    })
  })
})

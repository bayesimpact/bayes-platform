import {
  PUBLIC_API_MAJOR,
  PUBLIC_PATH_PREFIX,
  PublicChatLegacyRoutes,
  PublicChatRoutes,
} from "@caseai-connect/api-contracts"
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
import { createEmbedConfigWithSession } from "../../public-chat.factory"
import { PublicChatModule } from "../../public-chat.module"

/**
 * The unprefixed paths (`/public/agents/...`) predate versioning and stay served until the
 * last integrator moves to v1. They answer as they did then: no MCP App HTML route, no
 * `bannerText` in the config, a bare `event: error` frame on a stream failure. A failing
 * test here means the public contract changed: follow `docs/public-api-contract.md`.
 */
describe("PublicChat - unprefixed pre-versioning paths", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string
  let sessionId: string
  let sessionToken: string

  const versionedBase = `/${PUBLIC_PATH_PREFIX}/${PUBLIC_API_MAJOR}/agents/:embedToken`
  const unprefixedBase = `/${PUBLIC_PATH_PREFIX}/agents/:embedToken`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [PublicChatModule] })
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

  const createContext = async () => {
    const context = await createEmbedConfigWithSession(repositories, {
      bannerText: "Test version",
    })
    embedToken = context.embedConfig.embedToken
    sessionId = context.session.id
    sessionToken = context.sessionToken
  }

  const pathParams = () => ({ embedToken, sessionId })

  it("declares the pre-versioning routes only, each with the v1 method", () => {
    const routeKeys = Object.keys(PublicChatLegacyRoutes).sort()

    expect(routeKeys).toEqual(["createSession", "getConfig", "getSession", "streamMessages"])
    for (const key of routeKeys as (keyof typeof PublicChatLegacyRoutes)[]) {
      expect(PublicChatLegacyRoutes[key].method).toBe(PublicChatRoutes[key].method)
      expect(PublicChatLegacyRoutes[key].path).toBe(
        PublicChatRoutes[key].path.replace(versionedBase, unprefixedBase),
      )
    }
  })

  it("serves the config without the banner, which arrived with v1", async () => {
    await createContext()

    const versionedResponse = await request(app.getHttpServer())
      .get(PublicChatRoutes.getConfig.getPath(pathParams()))
      .set("Connection", "close")
    const unprefixedResponse = await request(app.getHttpServer())
      .get(PublicChatLegacyRoutes.getConfig.getPath(pathParams()))
      .set("Connection", "close")

    expect(versionedResponse.status).toBe(200)
    expect(unprefixedResponse.status).toBe(200)
    expect(versionedResponse.body.data.bannerText).toBe("Test version")
    expect(Object.keys(unprefixedResponse.body.data).sort()).toEqual([
      "agentName",
      "logoUrl",
      "primaryColor",
      "title",
    ])
    const { bannerText: _bannerText, ...versionedConfigWithoutBanner } = versionedResponse.body.data
    expect(unprefixedResponse.body.data).toEqual(versionedConfigWithoutBanner)
  })

  it("does not serve the MCP App HTML route, which arrived with v1", async () => {
    await createContext()
    const unprefixedPath = PublicChatRoutes.getMcpAppHtml
      .getPath(pathParams())
      .replace(`/${PUBLIC_PATH_PREFIX}/${PUBLIC_API_MAJOR}/`, `/${PUBLIC_PATH_PREFIX}/`)

    const response = await request(app.getHttpServer())
      .get(unprefixedPath)
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

    expect(response.status).toBe(404)
  })

  it("serves the same session body as the versioned path", async () => {
    await createContext()

    const versionedResponse = await request(app.getHttpServer())
      .get(PublicChatRoutes.getSession.getPath(pathParams()))
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)
    const unprefixedResponse = await request(app.getHttpServer())
      .get(PublicChatLegacyRoutes.getSession.getPath(pathParams()))
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

    expect(versionedResponse.status).toBe(200)
    expect(unprefixedResponse.status).toBe(200)
    expect(unprefixedResponse.body).toEqual(versionedResponse.body)
  })

  it("creates a session and returns the token pair", async () => {
    await createContext()

    const response = await request(app.getHttpServer())
      .post(PublicChatLegacyRoutes.createSession.getPath(pathParams()))
      .set("Connection", "close")
      .send({ payload: {} })

    expect(response.status).toBe(201)
    expect(Object.keys(response.body.data).sort()).toEqual(["sessionId", "sessionToken"])
  })

  it("ends a failing stream with a bare error frame, as it did before versioning", async () => {
    await createContext()
    const query = encodeURIComponent(JSON.stringify({ payload: { content: "" } }))

    const response = await request(app.getHttpServer())
      .get(`${PublicChatLegacyRoutes.streamMessages.getPath(pathParams())}?q=${query}`)
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

    expect(response.status).toBe(200)
    expect(response.headers["content-type"]).toMatch(/text\/event-stream/)
    expect(response.text).toContain("event: error")
  })

  it("guards the unprefixed paths like the versioned ones", async () => {
    await createContext()

    const withoutSessionToken = await request(app.getHttpServer())
      .get(PublicChatLegacyRoutes.getSession.getPath(pathParams()))
      .set("Connection", "close")
    expect(withoutSessionToken.status).toBe(401)

    const withUnknownEmbedToken = await request(app.getHttpServer())
      .get(
        PublicChatLegacyRoutes.getConfig.getPath({
          embedToken: "00000000-0000-0000-0000-000000000000",
          sessionId,
        }),
      )
      .set("Connection", "close")
    expect(withUnknownEmbedToken.status).toBe(401)
  })
})

import { randomUUID } from "node:crypto"
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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { agentEmbedConfigFactory } from "../../agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "../../public-agent-sessions/public-agent-session.factory"
import { PublicChatModule } from "../../public-chat.module"

/**
 * The unprefixed paths (`/public/agents/...`) predate versioning and are served as a
 * legacy alias for as long as v1 is served. The alias answers as it did before versioning:
 * no MCP App HTML route, no `bannerText` in the config. A failing test here means the public
 * contract changed: follow docs/public-api-contract.md.
 */
describe("PublicChat - legacy alias", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string
  let sessionId: string
  let sessionToken: string

  const publicBase = `/${PUBLIC_PATH_PREFIX}/${PUBLIC_API_MAJOR}/agents/:embedToken`
  const legacyBase = `/${PUBLIC_PATH_PREFIX}/agents/:embedToken`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [PublicChatModule],
    })
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
    const { organization, project, agent } = await createOrganizationWithAgent(repositories)
    const embedConfig = agentEmbedConfigFactory
      .transient({ organization, project, agent })
      .build({ isEnabled: true, bannerText: "Test version" })
    await repositories.agentEmbedConfigRepository.save(embedConfig)

    const knownToken = randomUUID()
    const session = publicAgentSessionFactory
      .transient({ embedConfig, sessionToken: knownToken })
      .build()
    await repositories.publicAgentSessionRepository.save(session)

    embedToken = embedConfig.embedToken
    sessionId = session.id
    sessionToken = knownToken
  }

  const pathParams = () => ({ embedToken, sessionId })

  it("declares the pre-versioning routes at the unprefixed path with the v1 method", () => {
    const legacyKeys = Object.keys(PublicChatLegacyRoutes).sort()
    expect(legacyKeys).toEqual(["createSession", "getConfig", "getSession", "streamMessages"])
    for (const key of legacyKeys as (keyof typeof PublicChatLegacyRoutes)[]) {
      const versioned = PublicChatRoutes[key]
      const legacy = PublicChatLegacyRoutes[key]
      expect(legacy.method).toBe(versioned.method)
      expect(legacy.path).toBe(versioned.path.replace(publicBase, legacyBase))
    }
  })

  it("serves the config without the banner, which arrived with v1", async () => {
    await createContext()
    const versionedResponse = await request(app.getHttpServer())
      .get(PublicChatRoutes.getConfig.getPath(pathParams()))
      .set("Connection", "close")
    const legacyResponse = await request(app.getHttpServer())
      .get(PublicChatLegacyRoutes.getConfig.getPath(pathParams()))
      .set("Connection", "close")
    expect(versionedResponse.status).toBe(200)
    expect(legacyResponse.status).toBe(200)
    expect(versionedResponse.body.data.bannerText).toBe("Test version")
    const { bannerText: _bannerText, ...v1ConfigWithoutBanner } = versionedResponse.body.data
    expect(legacyResponse.body.data).toEqual(v1ConfigWithoutBanner)
    expect(Object.keys(legacyResponse.body.data).sort()).toEqual([
      "agentName",
      "logoUrl",
      "primaryColor",
      "title",
    ])
  })

  it("does not serve the MCP App HTML route, which arrived with v1", async () => {
    await createContext()
    const legacyPath = PublicChatRoutes.getMcpAppHtml
      .getPath(pathParams())
      .replace(`/${PUBLIC_PATH_PREFIX}/${PUBLIC_API_MAJOR}/`, `/${PUBLIC_PATH_PREFIX}/`)
    const response = await request(app.getHttpServer())
      .get(legacyPath)
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)
    expect(response.status).toBe(404)
  })

  it("answers the same on the v1 path and on the legacy alias", async () => {
    await createContext()
    const routePairs = [
      [PublicChatRoutes.getSession, PublicChatLegacyRoutes.getSession, 200],
    ] as const
    for (const [versioned, legacy, status] of routePairs) {
      const versionedResponse = await request(app.getHttpServer())
        .get(versioned.getPath(pathParams()))
        .set("Connection", "close")
        .set("X-Session-Token", sessionToken)
      const legacyResponse = await request(app.getHttpServer())
        .get(legacy.getPath(pathParams()))
        .set("Connection", "close")
        .set("X-Session-Token", sessionToken)
      expect(versionedResponse.status).toBe(status)
      expect(legacyResponse.status).toBe(status)
      expect(legacyResponse.body).toEqual(versionedResponse.body)
    }

    for (const route of [PublicChatRoutes.createSession, PublicChatLegacyRoutes.createSession]) {
      const response = await request(app.getHttpServer())
        .post(route.getPath(pathParams()))
        .set("Connection", "close")
        .send({ payload: {} })
      expect(response.status).toBe(201)
      expect(Object.keys(response.body.data).sort()).toEqual(["sessionId", "sessionToken"])
    }
  })

  it("streams on the legacy alias", async () => {
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
})

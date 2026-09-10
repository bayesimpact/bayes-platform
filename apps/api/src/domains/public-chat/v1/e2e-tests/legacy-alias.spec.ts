import { randomUUID } from "node:crypto"
import {
  PUBLIC_API_MAJOR,
  PUBLIC_PATH_PREFIX,
  PublicChatLegacyRoutes,
  PublicChatRoutes,
  type PublicStreamEventPayload,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { parseSseDataEvents } from "@/common/test/sse.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createEmbedConfigWithSession } from "../../public-chat.factory"
import { PublicChatModule } from "../../public-chat.module"

/**
 * The unprefixed paths (`/public/agents/...`) predate versioning and stay served as an
 * alias of v1 for as long as v1 is served. Same routes, same bodies, same errors: only the
 * prefix differs. A failing test here means the public contract changed: follow
 * docs/public-api-contract.md.
 */
describe("PublicChat - legacy alias of v1", () => {
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
    const context = await createEmbedConfigWithSession(repositories, {
      bannerText: "Test version",
    })
    embedToken = context.embedConfig.embedToken
    sessionId = context.session.id
    sessionToken = context.sessionToken
    return context
  }

  const pathParams = () => ({ embedToken, sessionId })

  const getBoth = async (routeKey: "getConfig" | "getSession" | "getMcpAppHtml") => {
    const versionedResponse = await request(app.getHttpServer())
      .get(PublicChatRoutes[routeKey].getPath(pathParams()))
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)
    const legacyResponse = await request(app.getHttpServer())
      .get(PublicChatLegacyRoutes[routeKey].getPath(pathParams()))
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)
    return { versionedResponse, legacyResponse }
  }

  it("declares every v1 route at the unprefixed path with the same method", () => {
    const legacyKeys = Object.keys(PublicChatLegacyRoutes).sort()
    expect(legacyKeys).toEqual(Object.keys(PublicChatRoutes).sort())
    for (const key of legacyKeys as (keyof typeof PublicChatLegacyRoutes)[]) {
      const versioned = PublicChatRoutes[key]
      const legacy = PublicChatLegacyRoutes[key]
      expect(legacy.method).toBe(versioned.method)
      expect(legacy.path).toBe(versioned.path.replace(publicBase, legacyBase))
    }
  })

  it("serves the same config, banner included", async () => {
    await createContext()
    const { versionedResponse, legacyResponse } = await getBoth("getConfig")
    expect(versionedResponse.status).toBe(200)
    expect(legacyResponse.status).toBe(200)
    expect(versionedResponse.body.data.bannerText).toBe("Test version")
    expect(legacyResponse.body).toEqual(versionedResponse.body)
  })

  it("serves the same session and the same MCP App HTML", async () => {
    await createContext()
    for (const routeKey of ["getSession", "getMcpAppHtml"] as const) {
      const { versionedResponse, legacyResponse } = await getBoth(routeKey)
      expect(versionedResponse.status).toBe(200)
      expect(legacyResponse.status).toBe(200)
      expect(legacyResponse.body).toEqual(versionedResponse.body)
    }
  })

  it("creates sessions on both paths", async () => {
    await createContext()
    for (const route of [PublicChatRoutes.createSession, PublicChatLegacyRoutes.createSession]) {
      const response = await request(app.getHttpServer())
        .post(route.getPath(pathParams()))
        .set("Connection", "close")
        .send({ payload: {} })
      expect(response.status).toBe(201)
      expect(Object.keys(response.body.data).sort()).toEqual(["sessionId", "sessionToken"])
    }
  })

  it("streams the same events on the alias", async () => {
    await createContext()
    const query = JSON.stringify({ payload: { content: "Hello" } })
    const response = await request(app.getHttpServer())
      .get(PublicChatLegacyRoutes.streamMessages.getPath(pathParams()))
      .query({ q: query })
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)
    expect(response.status).toBe(200)
    expect(response.headers["content-type"]).toMatch(/^text\/event-stream/)
    const types = parseSseDataEvents<PublicStreamEventPayload>(response.text).map(
      (event) => event.type,
    )
    expect(types[0]).toBe("start")
    expect(types.at(-1)).toBe("end")
  })

  it("guards the alias like v1", async () => {
    await createContext()
    const unknownEmbedToken = await request(app.getHttpServer())
      .get(PublicChatLegacyRoutes.getConfig.getPath({ embedToken: randomUUID() }))
      .set("Connection", "close")
    expect(unknownEmbedToken.status).toBe(401)
    expect(unknownEmbedToken.body.message).toBe("Invalid embed token")

    const missingSessionToken = await request(app.getHttpServer())
      .get(PublicChatLegacyRoutes.getSession.getPath(pathParams()))
      .set("Connection", "close")
    expect(missingSessionToken.status).toBe(401)
    expect(missingSessionToken.body.message).toBe("Missing session token")

    const wrongMethod = await request(app.getHttpServer())
      .post(PublicChatLegacyRoutes.streamMessages.getPath(pathParams()))
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)
      .send({ payload: { content: "Hello" } })
    expect(wrongMethod.status).toBe(404)
  })
})

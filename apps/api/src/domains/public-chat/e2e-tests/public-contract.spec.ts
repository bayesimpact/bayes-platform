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
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { buildCorsOptionsDelegate } from "@/config/cors"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { agentEmbedConfigFactory } from "../agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "../public-agent-sessions/public-agent-session.factory"
import { PublicChatModule } from "../public-chat.module"

/**
 * Pins the wire-level facts of the public chat API contract v1 that types cannot
 * express: literal paths, methods, error bodies, SSE framing and CORS. A failing
 * test here means the public contract changed: follow docs/public-api-contract.md.
 */
describe("PublicChat - contract v1", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string
  let sessionId: string
  let sessionToken: string

  const publicBase = `/${PUBLIC_PATH_PREFIX}/${PUBLIC_API_MAJOR}/agents/:embedToken`
  const legacyBase = `/${PUBLIC_PATH_PREFIX}/agents/:embedToken`
  const hostOrigin = "https://host-page.example"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [PublicChatModule],
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    app.enableCors(buildCorsOptionsDelegate(["https://platform.example"]))
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
      .build({ isEnabled: true })
    await repositories.agentEmbedConfigRepository.save(embedConfig)

    const knownToken = randomUUID()
    const session = publicAgentSessionFactory
      .transient({ embedConfig, sessionToken: knownToken })
      .build()
    await repositories.publicAgentSessionRepository.save(session)

    embedToken = embedConfig.embedToken
    sessionId = session.id
    sessionToken = knownToken
    return { embedConfig, session, agent }
  }

  const pathParams = () => ({ embedToken, sessionId })

  const parseSseBlocks = (text: string) =>
    text
      .split("\n\n")
      .map((block) => block.split("\n").filter((line) => line.length > 0))
      .filter((lines) => lines.length > 0)

  const parseDataEvents = (text: string): PublicStreamEventPayload[] =>
    parseSseBlocks(text)
      .map((lines) => lines.find((line) => line.startsWith("data:")))
      .filter((line): line is string => Boolean(line))
      .map((line) => JSON.parse(line.slice("data:".length).trim()) as PublicStreamEventPayload)

  describe("routes", () => {
    it("declares the v1 paths and methods", () => {
      expect(PUBLIC_PATH_PREFIX).toBe("public")
      expect(PUBLIC_API_MAJOR).toBe("v1")
      expect(PublicChatRoutes.getConfig).toMatchObject({
        method: "get",
        path: `${publicBase}/config`,
      })
      expect(PublicChatRoutes.createSession).toMatchObject({
        method: "post",
        path: `${publicBase}/sessions`,
      })
      expect(PublicChatRoutes.getSession).toMatchObject({
        method: "get",
        path: `${publicBase}/sessions/:sessionId`,
      })
      expect(PublicChatRoutes.getMcpAppHtml).toMatchObject({
        method: "get",
        path: `${publicBase}/sessions/:sessionId/mcp-app-html`,
      })
      expect(PublicChatRoutes.streamMessages).toMatchObject({
        method: "get",
        path: `${publicBase}/sessions/:sessionId/messages/stream`,
      })
    })

    it("keeps the unprefixed legacy alias of v1", () => {
      for (const key of Object.keys(PublicChatRoutes) as (keyof typeof PublicChatRoutes)[]) {
        const versioned = PublicChatRoutes[key]
        const legacy = PublicChatLegacyRoutes[key]
        expect(legacy.method).toBe(versioned.method)
        expect(legacy.path).toBe(versioned.path.replace(publicBase, legacyBase))
      }
    })

    it("answers the same on the v1 path and on the legacy alias", async () => {
      await createContext()
      const routePairs = [
        [PublicChatRoutes.getConfig, PublicChatLegacyRoutes.getConfig, 200],
        [PublicChatRoutes.getSession, PublicChatLegacyRoutes.getSession, 200],
        [PublicChatRoutes.getMcpAppHtml, PublicChatLegacyRoutes.getMcpAppHtml, 200],
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

    it("does not accept POST on the stream path", async () => {
      await createContext()
      const response = await request(app.getHttpServer())
        .post(PublicChatRoutes.streamMessages.getPath(pathParams()))
        .set("Connection", "close")
        .set("X-Session-Token", sessionToken)
        .send({ payload: { content: "Hello" } })
      expect(response.status).toBe(404)
    })
  })

  describe("error bodies", () => {
    const expectError = (
      response: request.Response,
      statusCode: number,
      message: string,
      error: string,
    ) => {
      expect(response.status).toBe(statusCode)
      expect(response.body).toEqual({ statusCode, message, error })
    }

    it("401 Invalid embed token", async () => {
      const response = await request(app.getHttpServer())
        .get(PublicChatRoutes.getConfig.getPath({ embedToken: randomUUID() }))
        .set("Connection", "close")
      expectError(response, 401, "Invalid embed token", "Unauthorized")
    })

    it("403 Embed access is disabled for this agent", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories)
      const disabledConfig = agentEmbedConfigFactory
        .transient({ organization, project, agent })
        .build({ isEnabled: false })
      await repositories.agentEmbedConfigRepository.save(disabledConfig)
      const response = await request(app.getHttpServer())
        .get(PublicChatRoutes.getConfig.getPath({ embedToken: disabledConfig.embedToken }))
        .set("Connection", "close")
      expectError(response, 403, "Embed access is disabled for this agent", "Forbidden")
    })

    it("403 Origin not allowed", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories)
      const restrictedConfig = agentEmbedConfigFactory
        .transient({ organization, project, agent })
        .build({ isEnabled: true, allowedOrigins: ["https://allowed.example"] })
      await repositories.agentEmbedConfigRepository.save(restrictedConfig)
      const response = await request(app.getHttpServer())
        .get(PublicChatRoutes.getConfig.getPath({ embedToken: restrictedConfig.embedToken }))
        .set("Connection", "close")
        .set("Origin", hostOrigin)
      expectError(response, 403, "Origin not allowed", "Forbidden")
    })

    it("401 Missing session token", async () => {
      await createContext()
      const response = await request(app.getHttpServer())
        .get(PublicChatRoutes.getSession.getPath(pathParams()))
        .set("Connection", "close")
      expectError(response, 401, "Missing session token", "Unauthorized")
    })

    it("401 Invalid session token", async () => {
      await createContext()
      const response = await request(app.getHttpServer())
        .get(PublicChatRoutes.getSession.getPath(pathParams()))
        .set("Connection", "close")
        .set("X-Session-Token", "wrong-token")
      expectError(response, 401, "Invalid session token", "Unauthorized")
    })

    it("401 Session does not belong to this agent", async () => {
      await createContext()
      const { organization, project, agent } = await createOrganizationWithAgent(repositories)
      const otherConfig = agentEmbedConfigFactory
        .transient({ organization, project, agent })
        .build({ isEnabled: true })
      await repositories.agentEmbedConfigRepository.save(otherConfig)
      const response = await request(app.getHttpServer())
        .get(PublicChatRoutes.getSession.getPath({ embedToken: otherConfig.embedToken, sessionId }))
        .set("Connection", "close")
        .set("X-Session-Token", sessionToken)
      expectError(response, 401, "Session does not belong to this agent", "Unauthorized")
    })
  })

  describe("server-sent events", () => {
    const stream = (query: string) =>
      request(app.getHttpServer())
        .get(PublicChatRoutes.streamMessages.getPath(pathParams()))
        .query({ q: query })
        .set("Connection", "close")
        .set("X-Session-Token", sessionToken)

    it("frames each event as id + data, start then chunks then end", async () => {
      await createContext()
      const response = await stream(JSON.stringify({ payload: { content: "Hello" } }))
      expect(response.status).toBe(200)
      expect(response.headers["content-type"]).toMatch(/^text\/event-stream/)
      expect(response.text.startsWith("\n")).toBe(true)

      const blocks = parseSseBlocks(response.text)
      blocks.forEach((lines, index) => {
        expect(lines).toHaveLength(2)
        expect(lines[0]).toBe(`id: ${index + 1}`)
        expect(lines[1]?.startsWith("data: ")).toBe(true)
      })

      const events = parseDataEvents(response.text)
      const types = events.map((event) => event.type)
      expect(types[0]).toBe("start")
      expect(types.at(-1)).toBe("end")
      expect(types.slice(1, -1).every((type) => type === "chunk")).toBe(true)
      const endEvent = events.at(-1)
      const startEvent = events[0]
      const chunks = events.filter(
        (event): event is Extract<PublicStreamEventPayload, { type: "chunk" }> =>
          event.type === "chunk",
      )
      expect(endEvent?.type === "end" && endEvent.fullContent).toBe(
        chunks.map((event) => event.content).join(""),
      )
      const startMessageId = startEvent?.type === "start" ? startEvent.messageId : undefined
      expect(chunks.every((event) => event.messageId === startMessageId)).toBe(true)
    })

    it("rejects an invalid q payload inside the stream, not as a JSON error", async () => {
      await createContext()
      const response = await stream("not-json")
      expect(response.status).toBe(200)
      expect(response.text).toContain("event: error")
      expect(response.text).toContain("data: Invalid query format")
      expect(response.text).not.toContain('"type":"start"')
    })

    it("rejects an empty message inside the stream", async () => {
      await createContext()
      const response = await stream(JSON.stringify({ payload: { content: "   " } }))
      expect(response.status).toBe(200)
      expect(response.text).toContain("event: error")
      expect(response.text).toContain("data: User content must not be empty")
    })
  })

  describe("CORS", () => {
    it("reflects the caller origin on public routes, v1 and legacy", async () => {
      await createContext()
      for (const route of [PublicChatRoutes.getConfig, PublicChatLegacyRoutes.getConfig]) {
        const response = await request(app.getHttpServer())
          .get(route.getPath(pathParams()))
          .set("Connection", "close")
          .set("Origin", hostOrigin)
        expect(response.status).toBe(200)
        expect(response.headers["access-control-allow-origin"]).toBe(hostOrigin)
        expect(response.headers["access-control-allow-credentials"]).toBeUndefined()
      }
    })

    it("answers the preflight with the requested headers allowed", async () => {
      await createContext()
      const response = await request(app.getHttpServer())
        .options(PublicChatRoutes.getSession.getPath(pathParams()))
        .set("Connection", "close")
        .set("Origin", hostOrigin)
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "x-session-token")
      expect(response.status).toBe(204)
      expect(response.headers["access-control-allow-origin"]).toBe(hostOrigin)
      expect(response.headers["access-control-allow-headers"]).toBe("x-session-token")
    })

    it("does not reflect arbitrary origins outside the public namespace", async () => {
      const response = await request(app.getHttpServer())
        .get("/organizations")
        .set("Connection", "close")
        .set("Origin", hostOrigin)
      expect(response.headers["access-control-allow-origin"]).toBeUndefined()
    })
  })
})

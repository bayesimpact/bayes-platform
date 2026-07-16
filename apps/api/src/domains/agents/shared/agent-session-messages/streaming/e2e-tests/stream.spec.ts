import { AgentSessionMessagesRoutes, type StreamEventPayload } from "@caseai-connect/api-contracts"
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
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { StreamingModule } from "../streaming.module"

describe("AgentSessionMessagesRoutes.stream", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [StreamingModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent, conversationAgentSession } =
      await createOrganizationWithAgent(repositories, {
        agent: { type: "conversation" },
        withLiveConversationAgentSession: true,
      })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = conversationAgentSession!.id
    auth0Id = user.auth0Id
    return { organization, project, agent, session: conversationAgentSession! }
  }

  const subject = (content: string) => {
    const path = AgentSessionMessagesRoutes.stream.getPath({
      organizationId,
      projectId,
      agentId,
      agentSessionId,
    })
    const query = JSON.stringify({ payload: { content } })
    const req = request(app.getHttpServer())
      .get(path)
      .query({ q: query })
      .set("Connection", "close")
    if (accessToken) req.set("Authorization", `Bearer ${accessToken}`)
    return req
  }

  const parseSseEvents = (text: string): StreamEventPayload[] =>
    text
      .split("\n\n")
      .map((block) => block.split("\n").find((line) => line.startsWith("data:")))
      .filter((line): line is string => Boolean(line))
      .map((line) => JSON.parse(line.slice("data:".length).trim()) as StreamEventPayload)

  it("should stream the response", async () => {
    await createContext()

    const response = await subject("Hello")

    expect(response.status).toBe(200)

    const events = parseSseEvents(response.text)
    expect(events.length).toBeGreaterThan(0)

    const fulltextStream = events
      .filter((event) => event.type === "chunk")
      .map((event) => event.content)
      .join("")
    expect(fulltextStream).toBe("Hello, I'm the stream default mock value!")
  })

  it("should return error when empty content", async () => {
    await createContext()

    const response = await subject("")
    expect(response.status).toBe(200)
    expect(response.text).toContain("event: error")
  })

  it("should return 401 when invalid token", async () => {
    await createContext()
    accessToken = undefined

    const response = await subject("Hello")

    expect(response.status).toBe(401)
  })
})

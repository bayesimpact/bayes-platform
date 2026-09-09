import type { BaseAgentSessionTypeDto } from "@caseai-connect/api-contracts"
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
import type { Agent } from "@/domains/agents/agent.entity"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import type { Project } from "@/domains/projects/project.entity"
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
    await app.close()
  })

  const createContext = async ({
    sessionType = "live",
  }: {
    sessionType?: BaseAgentSessionTypeDto
  } = {}) => {
    const { user, organization, project, agent, agentSession, agentSettings } =
      await createOrganizationWithAgentSession({
        repositories,
        agentType: "conversation",
        params: { agentSession: { type: sessionType } },
      })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    auth0Id = user.auth0Id
    return { organization, project, agent, agentSettings, session: agentSession }
  }

  /** The stream is a GET: its payload travels JSON-encoded in `?q=`. */
  const rawSubject = (query: string) => {
    const path = AgentSessionMessagesRoutes.stream.getPath({
      organizationId,
      projectId,
      agentId,
      agentSessionId,
    })
    const req = request(app.getHttpServer())
      .get(path)
      .query({ q: query })
      .set("Connection", "close")
    if (accessToken) req.set("Authorization", `Bearer ${accessToken}`)
    return req
  }

  const subject = (content: string, agentSettingsRevision?: number) =>
    rawSubject(JSON.stringify({ payload: { content, agentSettingsRevision } }))

  const parseSseEvents = (text: string): StreamEventPayload[] =>
    text
      .split("\n\n")
      .map((block) => block.split("\n").find((line) => line.startsWith("data:")))
      .filter((line): line is string => Boolean(line))
      .map((line) => JSON.parse(line.slice("data:".length).trim()) as StreamEventPayload)

  const seedRevision = async ({
    organization,
    project,
    agent,
    revision,
    isDraft = false,
    isArchived = false,
  }: {
    organization: Organization
    project: Project
    agent: Agent
    revision: number
    isDraft?: boolean
    isArchived?: boolean
  }) => {
    const settings = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision, isDraft, isArchived })
    await repositories.agentSettingsRepository.save(settings)
    return settings
  }

  /** Settings row the assistant reply was persisted against. */
  const findAssistantMessageSettingsId = async () => {
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSessionId, role: "assistant" },
    })
    return messages[0]?.agentSettingsId
  }

  const errorData = (text: string) =>
    text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("")

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

  describe("settings version selection", () => {
    it("runs the requested published revision in the playground", async () => {
      // Revision 1 is not the newest: asking for it can only be answered by the resolver reading
      // the requested revision, never by the "latest published" lookup this route used before.
      const { organization, project, agent, agentSettings } = await createContext({
        sessionType: "playground",
      })
      await seedRevision({ organization, project, agent, revision: 2 })

      const response = await subject("Hello", agentSettings.revision)

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(agentSettings.id)
    })

    it("runs the published revision when a draft exists and it is the one requested", async () => {
      // The requirement the whole feature rests on: nobody demos a draft by accident. Pinning the
      // published version must win over the draft-first default.
      const { organization, project, agent, agentSettings } = await createContext({
        sessionType: "playground",
      })
      await seedRevision({ organization, project, agent, revision: 2, isDraft: true })

      const response = await subject("Hello", agentSettings.revision)

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(agentSettings.id)
    })

    it("runs the requested draft revision in the playground", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "playground" })
      const draft2 = await seedRevision({
        organization,
        project,
        agent,
        revision: 2,
        isDraft: true,
      })

      const response = await subject("Hello", 2)

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(draft2.id)
    })

    it("defaults a playground session with no revision to the draft", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "playground" })
      const draft2 = await seedRevision({
        organization,
        project,
        agent,
        revision: 2,
        isDraft: true,
      })

      const response = await subject("Hello")

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(draft2.id)
    })

    it("defaults a playground session with no draft to the published revision", async () => {
      const { organization, project, agent, agentSettings } = await createContext({
        sessionType: "playground",
      })
      await seedRevision({ organization, project, agent, revision: 2, isArchived: true })

      const response = await subject("Hello")

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(agentSettings.id)
    })

    it("rejects an unknown revision", async () => {
      await createContext({ sessionType: "playground" })

      const response = await subject("Hello", 99)

      expect(response.text).toContain("event: error")
      expect(errorData(response.text)).toContain("Version 99 not found")
    })

    it("rejects an archived revision", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "playground" })
      await seedRevision({ organization, project, agent, revision: 2, isArchived: true })

      const response = await subject("Hello", 2)

      expect(response.text).toContain("event: error")
      expect(errorData(response.text)).toContain("archived")
    })

    it("rejects a revision on a live session", async () => {
      const { organization, project, agent } = await createContext({ sessionType: "live" })
      await seedRevision({ organization, project, agent, revision: 2 })

      const response = await subject("Hello", 2)

      expect(response.text).toContain("event: error")
      expect(errorData(response.text)).toContain("playground")
    })

    it("rejects a revision that is not an integer", async () => {
      // The revision reaches TypeORM as-is, so anything else must be turned away here rather than
      // surface as a driver error.
      await createContext({ sessionType: "playground" })

      const response = await rawSubject(
        JSON.stringify({ payload: { content: "Hello", agentSettingsRevision: "2" } }),
      )

      expect(response.text).toContain("event: error")
      expect(errorData(response.text)).toContain("integer")
    })

    it("rejects a query whose payload is not an object", async () => {
      await createContext({ sessionType: "playground" })

      const response = await rawSubject(JSON.stringify({ payload: null }))

      expect(response.text).toContain("event: error")
      expect(errorData(response.text)).toContain("Invalid query format")
    })

    it("keeps running the published revision on a live session with no revision", async () => {
      const { organization, project, agent, agentSettings } = await createContext({
        sessionType: "live",
      })
      await seedRevision({ organization, project, agent, revision: 2, isDraft: true })

      const response = await subject("Hello")

      expect(response.text).not.toContain("event: error")
      expect(await findAssistantMessageSettingsId()).toBe(agentSettings.id)
    })
  })
})

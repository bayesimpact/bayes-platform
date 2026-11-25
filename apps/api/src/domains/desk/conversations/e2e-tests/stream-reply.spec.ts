import { DeskConversationsRoutes, type ReplyStreamEventDto } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import { In } from "typeorm"
import { parseSseDataEvents } from "@/common/test/sse.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageAttachmentDocumentFactory } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { DeskModule } from "../../desk.module"

describe("Desk conversations - streamReply", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const context = await createOrganizationWithAgentSession({
      repositories,
      agentType: "conversation",
      params: { agentSession: { type: "live" } },
    })
    const { organization, project, user, agent, agentSession } = context
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    authSubject = user.authSubject!
    return context
  }

  const streamPath = () =>
    DeskConversationsRoutes.streamReply.getPath({
      organizationId,
      projectId,
      agentId,
      agentSessionId,
    })

  /** The stream is a POST: the message travels in the body. */
  const subject = (body: object) => {
    const pending = supertest(app.getHttpServer())
      .post(streamPath())
      .send(body)
      .set("Connection", "close")
    if (accessToken) pending.set("Authorization", `Bearer ${accessToken}`)
    return pending
  }

  const countMessages = () =>
    repositories.agentMessageRepository.count({ where: { sessionId: agentSessionId } })

  it("streams the reply and stores both messages", async () => {
    await createContext()

    const response = await subject({ payload: { content: "Hello" } })

    expect(response.status).toBe(200)
    const events = parseSseDataEvents<ReplyStreamEventDto>(response.text)
    expect(events.map((event) => event.type)).toContain("start")
    expect(events.map((event) => event.type)).toContain("end")
    const fullText = events.map((event) => (event.type === "chunk" ? event.content : "")).join("")
    expect(fullText).toBe("Hello, I'm the stream default mock value!")
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSessionId, role: In(["user", "assistant"]) },
      order: { createdAt: "ASC" },
    })
    // The `tool` messages of the platform's own tools, such as the title, are left out.
    expect(messages.map((message) => [message.role, message.content])).toEqual([
      ["user", "Hello"],
      ["assistant", "Hello, I'm the stream default mock value!"],
    ])
  })

  it("attaches the uploaded document to the message the person typed", async () => {
    const { organization, project } = await createContext()
    const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.save(
      agentMessageAttachmentDocumentFactory.transient({ organization, project }).build(),
    )

    const response = await subject({
      payload: { content: "Hello", attachmentDocumentId: attachmentDocument.id },
    })

    expect(response.status).toBe(200)
    expect(response.text).not.toContain("event: error")
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSessionId, role: In(["user", "assistant"]) },
      order: { createdAt: "ASC" },
    })
    expect(messages.map((message) => [message.role, message.attachmentDocumentId ?? null])).toEqual(
      [
        ["user", attachmentDocument.id],
        ["assistant", null],
      ],
    )
  })

  it("answers with the version in production even when a draft exists", async () => {
    const { organization, project, agent, agentSettings } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, isDraft: true }),
    )

    const response = await subject({ payload: { content: "Hello" } })

    expect(response.text).not.toContain("event: error")
    const [reply] = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSessionId, role: "assistant" },
    })
    expect(reply?.agentSettingsId).toBe(agentSettings.id)
  })

  // The live route answers 200 with an SSE error frame for an empty message: the schema now
  // refuses it with a 400 before the stream starts.
  it.each([
    ["an empty message", ""],
    ["a message of spaces only", "   "],
  ])("answers 400 for %s", async (_case, content) => {
    await createContext()

    expectResponse(await subject({ payload: { content } }), 400)
    expect(await countMessages()).toBe(0)
  })

  it("answers 400 for a settings version, which only the playground chooses", async () => {
    await createContext()

    expectResponse(await subject({ payload: { content: "Hello", agentSettingsRevision: 1 } }), 400)
    expect(await countMessages()).toBe(0)
  })

  it("answers 400 for an attachment id that is not a UUID", async () => {
    await createContext()

    expectResponse(
      await subject({ payload: { content: "Hello", attachmentDocumentId: "not-a-uuid" } }),
      400,
    )
    expect(await countMessages()).toBe(0)
  })

  it("answers 400 for a body with no payload", async () => {
    await createContext()

    expectResponse(await subject({}), 400)
  })

  it("answers 401 without a token", async () => {
    await createContext()
    accessToken = undefined

    expectResponse(await subject({ payload: { content: "Hello" } }), 401)
  })

  it("does not read a message sent in the URL", async () => {
    // A message in the URL can exceed a proxy's limit and is copied to every access log.
    await createContext()

    const response = await supertest(app.getHttpServer())
      .get(streamPath())
      .query({ q: JSON.stringify({ payload: { content: "Hello" } }) })
      .set("Connection", "close")
      .set("Authorization", "Bearer token")

    expect(response.status).toBe(404)
    expect(await countMessages()).toBe(0)
  })
})

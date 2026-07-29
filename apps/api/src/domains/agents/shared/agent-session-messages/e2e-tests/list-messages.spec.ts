import {
  AgentSessionMessagesRoutes,
  type BaseAgentSessionTypeDto,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { type Requester, testRequester } from "../../../../../../test/request"
import { agentMessageFactory, createChitChatConversation } from "../agent-messages.factory"

describe("AgentSessionMessagesRoutes.listMessages", () => {
  let app: INestApplication<App>
  let request: Requester
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
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
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

  // Payload `type` (a policy input) and the session row's actual `type` (what the controller
  // checks to decide whether to stamp `agentSettings`) must agree, or a test exercising one only
  // looks like it is exercising the other.
  let sessionType: BaseAgentSessionTypeDto = "playground"

  const createContext = async (params: { sessionType?: BaseAgentSessionTypeDto } = {}) => {
    sessionType = params.sessionType ?? "playground"
    const { organization, user, project, agent, agentSettings, agentSession } =
      await createOrganizationWithAgentSession({
        repositories,
        agentType: "conversation",
        params: { agentSession: { type: sessionType } },
      })

    // add 2 messages (from the assistant and the user) to the session
    await createChitChatConversation(organization, project, agentSession, agentSettings, {
      agentMessageRepository: repositories.agentMessageRepository,
    })

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    auth0Id = user.auth0Id

    return { organization, user, project, agent, agentSettings, agentSession }
  }

  const subject = async () =>
    request({
      route: AgentSessionMessagesRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
      request: { payload: { type: sessionType } },
    })

  describe("listMessages", () => {
    it("should return messages for a session", async () => {
      await createContext()

      const response = await subject()

      expect(response.status).toBe(201)
      const messages = response.body.data
      expect(messages).toHaveLength(2)
      expect(messages[0]?.role).toBe("user")
      expect(messages[0]?.content).toBe("Hello")
      expect(messages[1]?.role).toBe("assistant")
      expect(messages[1]?.content).toBe("Hi!")
    })
  })

  describe("revision attribution", () => {
    it("should expose the revision that produced each message", async () => {
      const { agentSettings } = await createContext({ sessionType: "playground" })
      await repositories.agentSettingsRepository.update(agentSettings.id, {
        revisionName: "Warmer replies",
      })

      const response = await subject()

      expect(response.status).toBe(201)
      const messages = response.body.data
      expect(messages).toHaveLength(2)
      for (const message of messages) {
        expect(message.agentSettings).toEqual({
          revision: agentSettings.revision,
          revisionName: "Warmer replies",
          isDraft: false,
        })
      }
    })

    it("should report an unnamed revision with an empty name", async () => {
      await createContext({ sessionType: "playground" })

      const response = await subject()

      expect(response.status).toBe(201)
      expect(response.body.data[0]?.agentSettings?.revisionName).toBe("")
    })

    it("should attribute each message to its own revision when a session spans two", async () => {
      const { organization, project, agent, agentSession, agentSettings } = await createContext({
        sessionType: "playground",
      })
      const draft = agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, revisionName: "Draft tone", isDraft: true })
      await setup.getRepository(AgentSettings).save(draft)
      const laterMessage = agentMessageFactory
        .assistant()
        .transient({ organization, project, session: agentSession, agentSettings: draft })
        .build({ content: "Answer from the draft", createdAt: new Date(Date.now() + 60_000) })
      await repositories.agentMessageRepository.save(laterMessage)

      const response = await subject()

      expect(response.status).toBe(201)
      const messages = response.body.data
      expect(messages).toHaveLength(3)
      expect(messages[0]?.agentSettings?.revision).toBe(agentSettings.revision)
      expect(messages[2]?.agentSettings).toEqual({
        revision: 2,
        revisionName: "Draft tone",
        isDraft: true,
      })
    })
  })

  describe("live sessions", () => {
    it("should not carry any revision attribution", async () => {
      await createContext({ sessionType: "live" })

      const response = await subject()

      expect(response.status).toBe(201)
      const messages = response.body.data
      expect(messages).toHaveLength(2)
      for (const message of messages) {
        expect(message.agentSettings).toBeUndefined()
      }
    })
  })
})

import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { type Requester, testRequester } from "../../../../../../test/request"
import { createChitChatConversation } from "../agent-messages.factory"

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

  const createContext = async () => {
    const { organization, user, project, agent, agentSettings, agentSession } =
      await createOrganizationWithAgentSession({ repositories, agentType: "conversation" })

    // add 2 messages (from the assistant and the user) to the session
    await createChitChatConversation(organization, project, agentSession, agentSettings, {
      agentMessageRepository: repositories.agentMessageRepository,
    })

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    auth0Id = user.auth0Id

    return { organization, user, project, agent, agentSession }
  }

  const subject = async () =>
    request({
      route: AgentSessionMessagesRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
      request: { payload: { type: "live" } },
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
})

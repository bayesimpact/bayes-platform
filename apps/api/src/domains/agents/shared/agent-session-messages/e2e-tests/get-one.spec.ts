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
import { createOrganizationWithAgentMessage } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"

describe("AgentSessionMessagesRoutes.getOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let agentMessageId: string
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
    await app.close()
  })

  const createContext = async () => {
    const { organization, user, project, agent, agentSession, agentMessage } =
      await createOrganizationWithAgentMessage({ repositories, agentType: "conversation" })

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    agentMessageId = agentMessage.id
    auth0Id = user.auth0Id

    return { organization, project }
  }

  const subject = async ({
    messageId,
    payload,
  }: {
    messageId: string
    payload: typeof AgentSessionMessagesRoutes.getOne.request.payload
  }) =>
    request({
      route: AgentSessionMessagesRoutes.getOne,
      pathParams: removeNullish({
        organizationId,
        projectId,
        agentId,
        agentSessionId,
        messageId,
      }),
      token: accessToken,
      request: { payload },
    })

  it("should return message", async () => {
    await createContext()

    const response = await subject({
      messageId: agentMessageId,
      payload: {
        type: "live",
      },
    })

    expectResponse(response, 201)
    expect(response.body.data).toBeDefined()
    expect(response.body.data.id).toBe(agentMessageId)
  })

  it("should return not found", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000"
    await createContext()

    const response = await subject({
      messageId: nonExistentId,
      payload: {
        type: "live",
      },
    })

    expectResponse(response, 404)
    expect(response.body.data).toBeUndefined()
  })
})

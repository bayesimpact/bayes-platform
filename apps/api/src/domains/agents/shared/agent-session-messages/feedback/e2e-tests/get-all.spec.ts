import { AgentMessageFeedbackRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgentMessage } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../../test/request"
import { agentMessageFactory } from "../../agent-messages.factory"
import { agentMessageFeedbackFactory } from "../agent-message-feedback.factory"
import { AgentMessageFeedbackModule } from "../agent-message-feedback.module"

describe("AgentMessageFeedbackRoutes.getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentMessageFeedbackModule],
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
    const { user, organization, project, agent, agentSettings, agentMessage, agentSession } =
      await createOrganizationWithAgentMessage({ repositories, agentType: "conversation" })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { user, organization, project, agentMessage, agentSession, agentSettings }
  }

  const subject = async () =>
    request({
      route: AgentMessageFeedbackRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
    })

  it("should return feedback for an agent", async () => {
    const { user, organization, project, agentMessage } = await createContext()

    const feedback1 = agentMessageFeedbackFactory
      .transient({ user, organization, project, agentMessage })
      .build({
        content: "Feedback 1",
      })

    const feedback2 = agentMessageFeedbackFactory
      .transient({ user, organization, project, agentMessage })
      .build({
        content: "Feedback 2",
      })

    await repositories.agentMessageFeedbackRepository.save([feedback1, feedback2])

    const agentX = agentFactory.transient({ organization, project }).build({
      name: "Agent X",
    })
    await repositories.agentRepository.save(agentX)
    const agentSettingsX = agentSettingsFactory
      .transient({ organization, project, agent: agentX })
      .build()
    await repositories.agentSettingsRepository.save(agentSettingsX)

    const sessionX = conversationAgentSessionFactory
      .transient({ organization, project, agent: agentX, user })
      .build({
        type: "live",
        createdAt: new Date("2026-01-01T10:00:00Z"),
      })
    await repositories.conversationAgentSessionRepository.save([sessionX])

    const agentMessageX = agentMessageFactory
      .transient({ organization, project, session: sessionX, agentSettings: agentSettingsX })
      .build()
    await repositories.agentMessageRepository.save([agentMessageX])

    const feedbackX = agentMessageFeedbackFactory
      .transient({ user, organization, project, agentMessage: agentMessageX })
      .build({
        content: "Feedback X",
      })
    await repositories.agentMessageFeedbackRepository.save([feedbackX])

    const response = await subject()

    expectResponse(response, 200)
    const { feedbacks } = response.body.data
    expect(feedbacks).toHaveLength(2)
    expect(feedbacks.map((feedback) => feedback.content)).toContain("Feedback 1")
    expect(feedbacks.map((feedback) => feedback.content)).toContain("Feedback 2")
    expect(feedbacks[0]).toHaveProperty("id")
    expect(feedbacks[0]).toHaveProperty("createdAt")
  })
})

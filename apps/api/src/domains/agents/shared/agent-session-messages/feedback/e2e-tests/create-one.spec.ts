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
import { createOrganizationWithAgentMessage } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../../test/request"
import { AgentMessageFeedbackModule } from "../agent-message-feedback.module"

describe("AgentMessageFeedbackRoutes.createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentMessageId: string
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
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agentMessage } = await createOrganizationWithAgentMessage({
      repositories,
      params: { organizationMembership: { role: "member" } },
      agentType: "conversation",
    })
    organizationId = organization.id
    projectId = project.id
    agentMessageId = agentMessage.id
    auth0Id = user.auth0Id
    return { user, organization, project, agentMessage }
  }

  const subject = async (payload?: { content: string }) =>
    request({
      route: AgentMessageFeedbackRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentMessageId }),
      token: accessToken,
      request: payload ? { payload } : undefined,
    })

  it("should create feedback for an agent message", async () => {
    await createContext()

    const response = await subject({ content: "Persisted feedback" })

    expectResponse(response, 201)
    const feedback = response.body.data

    expect(feedback.success).toBeTruthy()
  })
})

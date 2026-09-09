import { AgentsRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import {
  createOrganizationWithAgent,
  createOrganizationWithAgentSession,
} from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"

describe("Agents - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent }
  }

  const subject = async () =>
    request({
      route: AgentsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
    })

  it("should delete an agent and return success", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    const deletedAgent = await repositories.agentRepository.findOne({
      where: { id: agentId },
    })
    expect(deletedAgent).toBeNull()
    await expectActivityCreated("agent.delete")
  })

  it("should delete agent and its sessions", async () => {
    const { user, organization, project, agent, agentSession } =
      await createOrganizationWithAgentSession({ repositories, agentType: "conversation" })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    const deletedAgent = await repositories.agentRepository.findOne({
      where: { id: agentId },
    })
    expect(deletedAgent).toBeNull()

    const deletedSession = await repositories.conversationAgentSessionRepository.findOne({
      where: { id: agentSession.id },
    })
    expect(deletedSession).toBeNull()
  })
})

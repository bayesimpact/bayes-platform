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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"

describe("Agents - updateOne", () => {
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
    const { user, organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent, agentSettings, user }
  }

  const subject = async (payload?: typeof AgentsRoutes.updateOne.request) =>
    request({
      route: AgentsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: payload,
    })

  it("should rename an agent and return success", async () => {
    await createContext()

    const response = await subject({ payload: { name: "Updated Agent" } })

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    const updatedAgent = await repositories.agentRepository.findOne({ where: { id: agentId } })
    expect(updatedAgent?.name).toBe("Updated Agent")
    await expectActivityCreated("agent.update")
  })

  it("should not create a settings revision when renaming an agent", async () => {
    const { agentSettings } = await createContext()

    const response = await subject({ payload: { name: "Renamed Agent" } })
    expectResponse(response, 200)

    const latestAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId },
      order: { revision: "DESC" },
    })
    expect(latestAgentSettings?.revision).toBe(agentSettings.revision)
    expect(latestAgentSettings?.isDraft).toBeFalsy()
  })

  it("should reject a name shorter than 3 characters", async () => {
    const { agent } = await createContext()

    const response = await subject({ payload: { name: "AB" } })

    expectResponse(response, 400)
    const notUpdatedAgent = await repositories.agentRepository.findOne({ where: { id: agentId } })
    expect(notUpdatedAgent?.name).toBe(agent.name)
  })
})

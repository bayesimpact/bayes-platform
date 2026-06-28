import { AgentHistoryRoutes } from "@caseai-connect/api-contracts"
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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"

describe("Agent History - getAll", () => {
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
      additionalImports: [AgentsModule],
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
    const { user, organization, project, agent, agentSettings } =
      await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent, agentSettings, user }
  }

  const subject = async () =>
    request({
      route: AgentHistoryRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
    })

  it("should return revisions for agent", async () => {
    const { organization, project, agent, agentSettings } = await createContext()

    const agentSettingsRev2 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({
        instructions: "Rev 2",
        revision: 2,
      })
    const agentSettingsRev3 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({
        instructions: "Rev 3",
        revision: 3,
      })
    await repositories.agentSettingsRepository.save([agentSettingsRev2, agentSettingsRev3])

    const response = await subject()

    expectResponse(response, 200)
    const agentHistory = response.body.data
    expect(agentHistory[0]?.instructions).toBe("Rev 3")
    expect(agentHistory[0]?.revision).toBe(3)
    expect(agentHistory[1]?.instructions).toBe("Rev 2")
    expect(agentHistory[1]?.revision).toBe(2)
    expect(agentHistory[2]?.instructions).toBe(agentSettings.instructions)
    expect(agentHistory[2]?.revision).toBe(1)
  })

  it("should return one item array when agent has only one revision has no agents", async () => {
    const { agentSettings } = await createContext()

    const response = await subject()

    expectResponse(response, 200)
    const agentHistory = response.body.data
    expect(agentHistory).toHaveLength(1)
    expect(agentHistory[0]?.instructions).toBe(agentSettings.instructions)
    expect(agentHistory[0]?.revision).toBe(1)
  })
})

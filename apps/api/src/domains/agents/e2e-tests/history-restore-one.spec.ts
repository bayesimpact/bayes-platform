import { AgentHistoryRoutes, AgentModel } from "@caseai-connect/api-contracts"
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

describe("Agent History - restoreOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let revision = "1"
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
    revision = "1"
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
      route: AgentHistoryRoutes.restoreOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, revision }),
      token: accessToken,
    })

  it("should copy the target revision as a new revision", async () => {
    const { organization, project, agent, agentSettings } = await createContext()

    const agentSettingsRev2 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({
        instructions: "Rev 2",
        model: AgentModel.Gemini25Flash,
        revision: 2,
      })
    await repositories.agentSettingsRepository.save(agentSettingsRev2)

    revision = "1"
    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data).toEqual({ success: true })

    const revisions = await repositories.agentSettingsRepository.find({
      where: { agentId: agent.id },
      order: { revision: "DESC" },
    })
    expect(revisions).toHaveLength(3)
    expect(revisions[0]?.revision).toBe(3)
    expect(revisions[0]?.instructions).toBe(agentSettings.instructions)
    expect(revisions[0]?.model).toBe(agentSettings.model)
  })

  it("should not create a new revision when the target equals the latest revision", async () => {
    const { agent } = await createContext()

    revision = "1"
    const response = await subject()

    expectResponse(response, 201)
    const revisions = await repositories.agentSettingsRepository.find({
      where: { agentId: agent.id },
    })
    expect(revisions).toHaveLength(1)
  })

  it("should return 404 when the revision does not exist", async () => {
    await createContext()

    revision = "42"
    expectResponse(await subject(), 404)
  })

  it("should return 422 when the revision is not a number", async () => {
    await createContext()

    revision = "not-a-number"
    expectResponse(await subject(), 422)
  })
})

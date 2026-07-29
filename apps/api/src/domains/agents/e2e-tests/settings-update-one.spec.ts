import { AgentSettingsRoutes, type UpdateAgentSettingsDto } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"

describe("Agent Settings - updateOne", () => {
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

  const createContext = async (params: Parameters<typeof createOrganizationWithAgent>[1] = {}) => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      params,
    )
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent, agentSettings, user }
  }

  let payload: UpdateAgentSettingsDto = {}

  const subject = async () =>
    request({
      route: AgentSettingsRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      request: { payload },
      token: accessToken,
    })

  it("should create a draft revision carrying the updated field", async () => {
    const { agentSettings } = await createContext()
    payload = { instructions: "Updated instructions" }

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.instructions).toBe("Updated instructions")
    expect(response.body.data.revision).toBe(agentSettings.revision + 1)
    expect(response.body.data.isDraft).toBe(true)
    expect(response.body.data.agentId).toBe(agentId)
  })

  it("should keep fields the payload omits", async () => {
    const { agentSettings } = await createContext()
    payload = { instructions: "Only the instructions change" }

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.model).toBe(agentSettings.model)
    expect(response.body.data.locale).toBe(agentSettings.locale)
  })

  it("should reuse the open draft instead of creating a second one", async () => {
    await createContext()
    payload = { instructions: "First edit" }
    await subject()
    payload = { instructions: "Second edit" }

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.revision).toBe(2)
    const stored = await repositories.agentSettingsRepository.find({ where: { agentId } })
    expect(stored).toHaveLength(2)
  })

  it("should reject enabling fillForm without an output schema", async () => {
    await createContext()
    payload = { fillFormEnabled: true }

    const response = await subject()

    expectResponse(response, 422)
  })

  it("should allow enabling fillForm alone when the current revision already has an output schema", async () => {
    const outputJsonSchema = { type: "object", properties: { summary: { type: "string" } } }
    await createContext({ agentSettings: { outputJsonSchema } })
    payload = { fillFormEnabled: true }

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.fillFormEnabled).toBe(true)
    expect(response.body.data.outputJsonSchema).toEqual(outputJsonSchema)
  })
})

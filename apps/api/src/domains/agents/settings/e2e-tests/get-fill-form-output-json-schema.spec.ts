import { randomUUID } from "node:crypto"
import { AgentSettingsRoutes } from "@caseai-connect/api-contracts"
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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"

const outputJsonSchema = {
  type: "object",
  properties: { title: { type: "string" }, summary: { type: "string" } },
}

describe("Agent Settings - getFillFormOutputJsonSchema", () => {
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
    revision = "1"
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

  const subject = async () =>
    request({
      route: AgentSettingsRoutes.getFillFormOutputJsonSchema,
      pathParams: removeNullish({ organizationId, projectId, agentId, revision }),
      token: accessToken,
    })

  it("should return the output JSON schema when the fill form is enabled", async () => {
    const { organization, project, agent } = await createContext()

    const revision2 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, fillFormEnabled: true, outputJsonSchema })
    await repositories.agentSettingsRepository.save(revision2)
    revision = "2"

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual(outputJsonSchema)
  })

  it("should not return the output JSON schema when the fill form is disabled", async () => {
    const { organization, project, agent } = await createContext()

    const revision2 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, fillFormEnabled: false, outputJsonSchema })
    await repositories.agentSettingsRepository.save(revision2)
    revision = "2"

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toBeUndefined()
  })

  it("should return no schema when the fill form is enabled but no schema is set", async () => {
    const { organization, project, agent } = await createContext()

    const revision2 = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, fillFormEnabled: true, outputJsonSchema: null })
    await repositories.agentSettingsRepository.save(revision2)
    revision = "2"

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toBeUndefined()
  })

  it("should return the schema of the requested revision, not the latest one", async () => {
    const { organization, project, agent } = await createContext()

    await repositories.agentSettingsRepository.save([
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ revision: 2, fillFormEnabled: true, outputJsonSchema }),
      agentSettingsFactory.transient({ organization, project, agent }).build({
        revision: 3,
        fillFormEnabled: true,
        outputJsonSchema: { type: "object", properties: { other: { type: "string" } } },
      }),
    ])
    revision = "2"

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual(outputJsonSchema)
  })

  it("should reject an invalid revision", async () => {
    await createContext()
    revision = "not-a-number"

    expectResponse(await subject(), 422, 'Invalid revision "not-a-number"')
  })

  it("should return 404 for an unknown revision", async () => {
    await createContext()
    revision = "42"

    expectResponse(await subject(), 404)
  })

  it("should not leak a revision belonging to another agent", async () => {
    const { organization, project } = await createContext()

    const otherAgent = agentFactory
      .transient({ organization, project })
      .build({ name: "Other Agent" })
    await repositories.agentRepository.save(otherAgent)
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({ organization, project, agent: otherAgent })
        .build({ revision: 2, fillFormEnabled: true, outputJsonSchema }),
    )
    revision = "2"

    expectResponse(await subject(), 404)
  })

  it("requires an authentication token", async () => {
    await createContext()
    accessToken = undefined

    expectResponse(await subject(), 401)
  })

  it("requires a valid agent ID", async () => {
    await createContext()
    agentId = randomUUID()

    expectResponse(await subject(), 404)
  })
})

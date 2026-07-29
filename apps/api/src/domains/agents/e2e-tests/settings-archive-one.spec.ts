import { AgentSettingsRoutes } from "@caseai-connect/api-contracts"
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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import {
  agentSettingsValuesRev1,
  agentSettingsValuesRev2Archived,
  agentSettingsValuesRev3Draft,
} from "@/domains/agents/settings/agent.settings.spec.helper"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"

describe("Agents - archiveOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let revision: string
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
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, user, agent } = await createOrganizationWithAgent(repositories, {
      agentSettings: {
        ...agentSettingsValuesRev1,
        revisionName: "FirstRev",
        revisionDesc: "The first revision",
      },
    })
    const agentSettings2 = agentSettingsFactory
      .transient({ organization: organization, project, agent })
      .build({ ...agentSettingsValuesRev2Archived, revision: 2, isArchived: true })

    const agentSettings3 = agentSettingsFactory
      .transient({ organization: organization, project, agent })
      .build({ ...agentSettingsValuesRev3Draft, revision: 3, isDraft: true })

    // A second published, non-archived revision so revision 1 is not the agent's only readable
    // one: several tests below archive revision 1 and expect it to still be allowed.
    const agentSettings4 = agentSettingsFactory
      .transient({ organization: organization, project, agent })
      .build({ ...agentSettingsValuesRev1, revision: 4 })

    await repositories.agentSettingsRepository.save([
      agentSettings2,
      agentSettings3,
      agentSettings4,
    ])

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    auth0Id = user.auth0Id
    return { organization, project, agent, user }
  }

  const subject = async () =>
    request({
      route: AgentSettingsRoutes.archiveOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, revision }),
      token: accessToken,
    })

  it("should archive a revision - not draft", async () => {
    const { agent } = await createContext()

    const initialAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 1 },
    })
    expect(initialAgentSettings?.isDraft).toBeFalsy()
    expect(initialAgentSettings?.isArchived).toBeFalsy()

    revision = "1"
    const response = await subject()
    expectResponse(response, 201)
    expect(response.body).toEqual({ data: { success: true } })

    const updatedAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 1 },
    })
    expect(updatedAgentSettings?.isArchived).toBeTruthy()
    // The activity must link back to the agent, not the settings revision: `agentSettings` is
    // not a resolved context property, only `agent` is (see AgentContextResolver).
    await expectActivityCreated("agentSettings.archive", {
      entityId: agent.id,
      entityType: "agent",
    })
  })

  it("should refuse to archive the only remaining published, non-archived revision", async () => {
    const { agent } = await createContext()

    // Archive revision 4 first so revision 1 becomes the agent's only non-archived published
    // revision.
    await repositories.agentSettingsRepository.update(
      { agentId: agent.id, revision: 4 },
      { isArchived: true },
    )

    revision = "1"
    const response = await subject()
    expectResponse(response, 422)

    const untouched = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 1 },
    })
    expect(untouched?.isArchived).toBeFalsy()
  })

  it("should fail with a draft revision - draft", async () => {
    await createContext()

    const initialAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 3 },
    })
    expect(initialAgentSettings?.isDraft).toBeTruthy()
    expect(initialAgentSettings?.isArchived).toBeFalsy()
    expect(initialAgentSettings?.revisionName).not.toBe("revisionName")
    expect(initialAgentSettings?.revisionDesc).not.toBe("revisionDesc")

    revision = "3"
    const response = await subject()
    expectResponse(response, 422)
  })
  it("should fail with invalid revision", async () => {
    await createContext()
    revision = "0"
    const response = await subject()
    expectResponse(response, 422)
  })
  it("should fail with not found revision", async () => {
    await createContext()
    revision = "99"
    const response = await subject()
    expectResponse(response, 404)
  })
})

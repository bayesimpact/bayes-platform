import { AgentSettingsRoutes } from "@bayes-platform/api-contracts"
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
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"

describe("Agent Settings - archiveOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let revision: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    // Revision 1 is saved but out of production, so it may be archived.
    const { organization, project, user, agent } = await createOrganizationWithAgent(repositories, {
      agentSettings: {
        ...agentSettingsValuesRev1,
        revisionName: "FirstRev",
        revisionDesc: "The first revision",
        isProduction: false,
      },
    })
    const agentSettings2 = agentSettingsFactory
      .transient({ organization: organization, project, agent })
      .build({ ...agentSettingsValuesRev2Archived, revision: 2, isArchived: true })

    const agentSettings3 = agentSettingsFactory
      .transient({ organization: organization, project, agent })
      .build({ ...agentSettingsValuesRev3Draft, revision: 3, isDraft: true })

    await repositories.agentSettingsRepository.save([agentSettings2, agentSettings3])

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = user.authSubject!
    return { organization, project, agent, user }
  }

  const subject = async () =>
    request({
      route: AgentSettingsRoutes.archiveOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, revision }),
      token: accessToken,
    })

  it("should archive a revision - not draft", async () => {
    await createContext()

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
    await expectActivityCreated("agentSettings.archive")
  })

  it("should refuse to archive the version in production", async () => {
    await createContext()
    await repositories.agentSettingsRepository.update(
      { agentId, revision: 1 },
      { isProduction: true },
    )

    revision = "1"
    const response = await subject()
    expectResponse(response, 422, "The version in production cannot be archived")

    const productionSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 1 },
    })
    expect(productionSettings?.isArchived).toBe(false)
  })

  it("should discard the draft - draft", async () => {
    await createContext()

    const initialAgentSettings = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 3 },
    })
    expect(initialAgentSettings?.isDraft).toBeTruthy()
    expect(initialAgentSettings?.isArchived).toBeFalsy()

    revision = "3"
    const response = await subject()
    expectResponse(response, 201)

    const discardedDraft = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 3 },
    })
    expect(discardedDraft?.isArchived).toBe(true)
  })

  it("should fail with the draft of an agent with no saved version - draft", async () => {
    await createContext()
    await repositories.agentSettingsRepository.delete({ agentId, revision: 1 })
    await repositories.agentSettingsRepository.delete({ agentId, revision: 2 })

    revision = "3"
    const response = await subject()
    expectResponse(response, 422, "The draft of an agent with no saved version cannot be discarded")

    const draft = await repositories.agentSettingsRepository.findOne({
      where: { agentId, revision: 3 },
    })
    expect(draft?.isArchived).toBe(false)
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

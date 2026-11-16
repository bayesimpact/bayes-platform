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
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"

describe("Agent Settings - setProduction", () => {
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

  // Revision 1 is in production, 2 is archived, 3 is saved and 4 is the draft.
  const createContext = async () => {
    const { organization, project, user, agent } = await createOrganizationWithAgent(repositories, {
      agentSettings: agentSettingsValuesRev1,
    })
    await repositories.agentSettingsRepository.save([
      agentSettingsFactory
        .transient({ organization, project, agent })
        .archived()
        .build({ ...agentSettingsValuesRev2Archived, revision: 2 }),
      agentSettingsFactory
        .transient({ organization, project, agent })
        .build({ ...agentSettingsValuesRev3Draft, revision: 3 }),
      agentSettingsFactory
        .transient({ organization, project, agent })
        .draft()
        .build({ ...agentSettingsValuesRev3Draft, revision: 4 }),
    ])

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = user.authSubject!
  }

  const findProductionRevisions = async () =>
    (
      await repositories.agentSettingsRepository.find({
        where: { agentId, isProduction: true },
      })
    ).map((agentSettings) => agentSettings.revision)

  const subject = async () =>
    request({
      route: AgentSettingsRoutes.setProduction,
      pathParams: removeNullish({ organizationId, projectId, agentId, revision }),
      token: accessToken,
    })

  it("should put a saved version in production and take the previous one out", async () => {
    await createContext()
    expect(await findProductionRevisions()).toEqual([1])

    revision = "3"
    const response = await subject()
    expectResponse(response, 201)
    expect(response.body).toEqual({ data: { success: true } })

    expect(await findProductionRevisions()).toEqual([3])
    await expectActivityCreated("agentSettings.setProduction")
  })

  it("should leave the versions' dates alone", async () => {
    await createContext()
    const before = await repositories.agentSettingsRepository.find({ where: { agentId } })

    revision = "3"
    expectResponse(await subject(), 201)

    const after = await repositories.agentSettingsRepository.find({ where: { agentId } })
    for (const agentSettings of after) {
      const previous = before.find((candidate) => candidate.id === agentSettings.id)
      expect(agentSettings.updatedAt).toEqual(previous?.updatedAt)
    }
  })

  it("should put an older version back in production", async () => {
    await createContext()
    revision = "3"
    expectResponse(await subject(), 201)

    revision = "1"
    expectResponse(await subject(), 201)

    expect(await findProductionRevisions()).toEqual([1])
  })

  it("should accept the version already in production", async () => {
    await createContext()
    revision = "1"
    expectResponse(await subject(), 201)
    expect(await findProductionRevisions()).toEqual([1])
  })

  it("should refuse the draft", async () => {
    await createContext()
    revision = "4"
    expectResponse(await subject(), 422, "Save the draft before putting it in production")
    expect(await findProductionRevisions()).toEqual([1])
  })

  it("should refuse an archived version", async () => {
    await createContext()
    revision = "2"
    expectResponse(await subject(), 422, "Version 2 is archived")
    expect(await findProductionRevisions()).toEqual([1])
  })

  it("should fail with invalid revision", async () => {
    await createContext()
    revision = "0"
    expectResponse(await subject(), 422)
  })

  it("should fail with not found revision", async () => {
    await createContext()
    revision = "99"
    expectResponse(await subject(), 404)
  })
})

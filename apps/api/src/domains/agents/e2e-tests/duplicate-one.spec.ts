import { AgentModel, AgentSettingsRoutes, AgentsRoutes } from "@caseai-connect/api-contracts"
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
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"
import { agentSettingsFactory } from "../settings/agent.settings.factory"

describe("Agents - duplicateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
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
    const context = await createOrganizationWithAgent(repositories, {
      agent: { name: "Helpful Assistant", type: "conversation" },
      agentSettings: { revision: 1, model: AgentModel.Gemini35Flash },
    })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject!
    return context
  }

  const subject = async (name = "Helpful Assistant (copy)") =>
    request({
      route: AgentsRoutes.duplicateOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: { payload: { name } },
    })

  const listLiveAgents = async () =>
    request({
      route: AgentsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
    })

  const listStudioAgents = async () =>
    request({
      route: AgentsRoutes.getAllWithDrafts,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
    })

  it("returns the copy as a draft that was never published", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data).toMatchObject({
      name: "Helpful Assistant (copy)",
      type: "conversation",
      projectId,
      draftRevision: { number: 1 },
    })
    expect(response.body.data.id).not.toBe(agentId)
    expect(response.body.data.currentRevision).toBeUndefined()
    const copySettings = await repositories.agentSettingsRepository.find({
      where: { agentId: response.body.data.id },
    })
    expect(copySettings).toMatchObject([
      { revision: 1, isDraft: true, model: AgentModel.Gemini35Flash },
    ])
  })

  it("records who duplicated which agent", async () => {
    const { user } = await createContext()

    expectResponse(await subject(), 201)

    await expectActivityCreated("agent.duplicate", {
      userId: user.id,
      organizationId,
      projectId,
      entityId: agentId,
      entityType: "agent",
    })
  })

  it("lists the copy in the studio as unpublished and keeps it out of the live list", async () => {
    await createContext()
    const copyId = (await subject()).body.data.id

    const studioList = await listStudioAgents()
    const liveList = await listLiveAgents()

    expectResponse(studioList, 200)
    const studioCopy = studioList.body.data.find((agent) => agent.id === copyId)
    expect(studioCopy?.currentRevision).toBeUndefined()
    expect(studioCopy?.draftRevision?.number).toBe(1)
    expectResponse(liveList, 200)
    expect(liveList.body.data.map((agent) => agent.id)).toEqual([agentId])
  })

  it("lists the copy everywhere once its draft is published", async () => {
    await createContext()
    const copyId = (await subject()).body.data.id
    // Published the way the studio's Publish button does it.
    const published = await request({
      route: AgentSettingsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId: copyId, revision: "1" }),
      token: "token",
      request: { payload: { revisionName: "First version" } },
    })
    expectResponse(published, 201)

    const liveList = await listLiveAgents()
    const studioList = await listStudioAgents()

    expect(liveList.body.data.map((agent) => agent.id).sort()).toEqual([agentId, copyId].sort())
    const studioCopy = studioList.body.data.find((agent) => agent.id === copyId)
    expect(studioCopy?.currentRevision?.number).toBe(1)
    expect(studioCopy?.draftRevision).toBeUndefined()
  })

  it("copies the published settings, not the draft being edited", async () => {
    const { organization, project, agent } = await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: 2, model: AgentModel.Gemini38Flash }),
    )

    const response = await subject()

    expectResponse(response, 201)
    const [copySettings] = await repositories.agentSettingsRepository.find({
      where: { agentId: response.body.data.id },
    })
    expect(copySettings?.model).toBe(AgentModel.Gemini35Flash)
  })

  it("refuses a name under 3 characters", async () => {
    await createContext()

    expectResponse(await subject("ab"), 400)
    expect(await repositories.agentRepository.count()).toBe(1)
  })
})

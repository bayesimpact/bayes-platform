import { AgentsRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { AgentsModule } from "../agents.module"
import { addUserToAgent } from "../memberships/agent-membership.factory"

describe("Agents - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
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
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    return { organization, project, user }
  }

  const subject = async () =>
    request({
      route: AgentsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("should return agents for a project", async () => {
    const { organization, project, user } = await createContext()

    const agent1 = agentFactory.transient({ organization, project }).build({
      name: "Agent 1",
    })
    const agent2 = agentFactory.transient({ organization, project }).build({
      name: "Agent 2",
    })
    await repositories.agentRepository.save([agent1, agent2])

    const agentSettings1 = agentSettingsFactory
      .transient({ organization, project, agent: agent1 })
      .build()
    const agentSettings2 = agentSettingsFactory
      .transient({ organization, project, agent: agent2 })
      .build()
    await repositories.agentSettingsRepository.save([agentSettings1, agentSettings2])

    await addUserToAgent({ repositories, agent: agent1, user })
    await addUserToAgent({ repositories, agent: agent2, user })

    const response = await subject()

    expectResponse(response, 200)
    const agents = response.body.data
    expect(agents).toHaveLength(2)
    expect(agents.map((agent) => agent.name)).toContain("Agent 1")
    expect(agents.map((agent) => agent.name)).toContain("Agent 2")
    expect(agents[0]).toHaveProperty("id")
    expect(agents[0]).toHaveProperty("createdAt")
    expect(agents[0]?.projectId).toBe(projectId)
    expect(agents[0]?.currentRevision.number).toBe(1)
    expect(agents[0]?.currentRevision.updatedAt).toBeDefined()
  })

  it("should expose the revision name and description on the current revision", async () => {
    const { organization, project, user } = await createContext()

    const agent = agentFactory.transient({ organization, project }).build({ name: "Named Agent" })
    await repositories.agentRepository.save(agent)
    const agentSettings = agentSettingsFactory.transient({ organization, project, agent }).build({
      revisionName: "Launch",
      revisionDesc: "The revision we launched with",
    })
    await repositories.agentSettingsRepository.save(agentSettings)
    await addUserToAgent({ repositories, agent, user })
    const storedSettings = await repositories.agentSettingsRepository.findOneOrFail({
      where: { id: agentSettings.id },
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data[0]?.currentRevision).toEqual({
      number: 1,
      name: "Launch",
      description: "The revision we launched with",
      updatedAt: storedSettings.updatedAt.getTime(),
    })
  })

  it("should return the last published revision and ignore a newer draft", async () => {
    const { organization, project, user } = await createContext()

    const agent = agentFactory.transient({ organization, project }).build({ name: "Drafted Agent" })
    await repositories.agentRepository.save(agent)
    const publishedRevision = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 1, revisionName: "Published" })
    const draftRevision = agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ revision: 2, revisionName: "Draft", isDraft: true })
    await repositories.agentSettingsRepository.save([publishedRevision, draftRevision])
    await addUserToAgent({ repositories, agent, user })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]?.currentRevision.number).toBe(1)
    expect(response.body.data[0]?.currentRevision.name).toBe("Published")
    // getAll is the draft-free view; the draft is only exposed by getAllWithDrafts.
    expect(response.body.data[0]).not.toHaveProperty("draftRevision")
  })

  it("should return empty array when project has no agents", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })
})

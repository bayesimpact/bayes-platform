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

describe("Agents - getAllWithDrafts", () => {
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
      route: AgentsRoutes.getAllWithDrafts,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  /** Creates an agent the user is a member of, plus the given settings revisions. */
  const createAgentWithRevisions = async ({
    organization,
    project,
    user,
    name,
    revisions,
  }: {
    organization: Awaited<ReturnType<typeof createContext>>["organization"]
    project: Awaited<ReturnType<typeof createContext>>["project"]
    user: Awaited<ReturnType<typeof createContext>>["user"]
    name: string
    revisions: Array<{
      revision: number
      revisionName?: string
      revisionDesc?: string
      isDraft?: boolean
      isArchived?: boolean
    }>
  }) => {
    const agent = agentFactory.transient({ organization, project }).build({ name })
    await repositories.agentRepository.save(agent)
    const agentSettings = revisions.map((revision) =>
      agentSettingsFactory.transient({ organization, project, agent }).build(revision),
    )
    await repositories.agentSettingsRepository.save(agentSettings)
    await addUserToAgent({ repositories, agent, user })
    return { agent, agentSettings }
  }

  it("should return the published revision and the pending draft side by side", async () => {
    const { organization, project, user } = await createContext()
    const { agent } = await createAgentWithRevisions({
      organization,
      project,
      user,
      name: "Drafted Agent",
      revisions: [
        { revision: 1, revisionName: "Published", revisionDesc: "Live for everyone" },
        { revision: 2, revisionName: "Draft", revisionDesc: "Work in progress", isDraft: true },
      ],
    })
    const storedRevisions = await repositories.agentSettingsRepository.find({
      where: { agentId: agent.id },
      order: { revision: "ASC" },
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    const returnedAgent = response.body.data[0]
    expect(returnedAgent?.id).toBe(agent.id)
    expect(returnedAgent?.name).toBe("Drafted Agent")
    expect(returnedAgent?.currentRevision).toEqual({
      number: 1,
      name: "Published",
      description: "Live for everyone",
      updatedAt: storedRevisions[0]?.updatedAt.getTime(),
    })
    expect(returnedAgent?.draftRevision).toEqual({
      number: 2,
      name: "Draft",
      description: "Work in progress",
      updatedAt: storedRevisions[1]?.updatedAt.getTime(),
    })
  })

  it("should omit draftRevision when the agent has no pending draft", async () => {
    const { organization, project, user } = await createContext()
    await createAgentWithRevisions({
      organization,
      project,
      user,
      name: "Clean Agent",
      revisions: [{ revision: 1, revisionName: "Published" }],
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]?.currentRevision.number).toBe(1)
    expect(response.body.data[0]?.draftRevision).toBeUndefined()
  })

  it("should report the latest published revision as current when a draft was published", async () => {
    const { organization, project, user } = await createContext()
    await createAgentWithRevisions({
      organization,
      project,
      user,
      name: "Republished Agent",
      revisions: [
        { revision: 1, revisionName: "First" },
        { revision: 2, revisionName: "Second" },
      ],
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data[0]?.currentRevision.number).toBe(2)
    expect(response.body.data[0]?.currentRevision.name).toBe("Second")
    expect(response.body.data[0]?.draftRevision).toBeUndefined()
  })

  it("should skip archived revisions when resolving the current revision", async () => {
    const { organization, project, user } = await createContext()
    await createAgentWithRevisions({
      organization,
      project,
      user,
      name: "Archived Agent",
      revisions: [
        { revision: 1, revisionName: "First" },
        { revision: 2, revisionName: "Archived", isArchived: true },
      ],
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data[0]?.currentRevision.number).toBe(1)
    expect(response.body.data[0]?.currentRevision.name).toBe("First")
  })

  it("should resolve drafts independently for each agent of the project", async () => {
    const { organization, project, user } = await createContext()
    await createAgentWithRevisions({
      organization,
      project,
      user,
      name: "With Draft",
      revisions: [{ revision: 1 }, { revision: 2, isDraft: true }],
    })
    await createAgentWithRevisions({
      organization,
      project,
      user,
      name: "Without Draft",
      revisions: [{ revision: 1 }],
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(2)
    const byName = new Map(response.body.data.map((agent) => [agent.name, agent]))
    expect(byName.get("With Draft")?.draftRevision?.number).toBe(2)
    expect(byName.get("Without Draft")?.draftRevision).toBeUndefined()
  })

  it("should return empty array when project has no agents", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })
})

import { AgentMemoriesRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentMemoriesModule } from "../agent-memories.module"
import { agentMemoryFactory } from "../agent-memory.factory"

describe("Agent Memories - deleteOne and deleteAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentMemoriesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** The caller's live fact, their playground fact, and another user's live fact. */
  const createContext = async () => {
    const { organization, project, agent, user } = await createOrganizationWithAgent(repositories)
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    authSubject = user.authSubject as string
    const otherUser = await repositories.userRepository.save(userFactory.build())
    const [own, ownPlayground, others] = await repositories.agentMemoryRepository.save([
      agentMemoryFactory.transient({ organization, project, agent, user }).build(),
      agentMemoryFactory
        .transient({ organization, project, agent, user })
        .build({ sessionType: "playground" }),
      agentMemoryFactory.transient({ organization, project, agent, user: otherUser }).build(),
    ])
    return { own, ownPlayground, others }
  }

  const remainingIds = async () =>
    (await repositories.agentMemoryRepository.find({ withDeleted: true }))
      .map((memory) => memory.id)
      .sort()

  it("deleteOne removes the caller's fact for good", async () => {
    const { own, ownPlayground, others } = await createContext()

    const response = await request({
      route: AgentMemoriesRoutes.deleteOne,
      pathParams: { organizationId, projectId, agentId, sessionType: "live", memoryId: own.id },
      token: "token",
    })

    expectResponse(response, 200)
    expect(await remainingIds()).toEqual([ownPlayground.id, others.id].sort())
  })

  it("deleteOne cannot reach another user's fact", async () => {
    const { others } = await createContext()

    const response = await request({
      route: AgentMemoriesRoutes.deleteOne,
      pathParams: { organizationId, projectId, agentId, sessionType: "live", memoryId: others.id },
      token: "token",
    })

    expectResponse(response, 404)
    expect(await remainingIds()).toContain(others.id)
  })

  it("deleteAll clears the caller's memory for one session type only", async () => {
    const { ownPlayground, others } = await createContext()

    const response = await request({
      route: AgentMemoriesRoutes.deleteAll,
      pathParams: { organizationId, projectId, agentId, sessionType: "live" },
      token: "token",
    })

    expectResponse(response, 200)
    expect(await remainingIds()).toEqual([ownPlayground.id, others.id].sort())
  })
})

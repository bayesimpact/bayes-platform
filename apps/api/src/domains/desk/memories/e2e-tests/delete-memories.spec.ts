import { randomUUID } from "node:crypto"
import { DeskMemoriesRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentMemoryFactory } from "@/domains/agents/memories/agent-memory.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk memories - deleteOne and deleteAll", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
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
    const own = await repositories.agentMemoryRepository.save(
      agentMemoryFactory.transient({ organization, project, agent, user }).build(),
    )
    const ownPlayground = await repositories.agentMemoryRepository.save(
      agentMemoryFactory
        .transient({ organization, project, agent, user })
        .build({ sessionType: "playground" }),
    )
    const others = await repositories.agentMemoryRepository.save(
      agentMemoryFactory.transient({ organization, project, agent, user: otherUser }).build(),
    )
    return { organization, project, user, own, ownPlayground, others }
  }

  const remainingIds = async () =>
    (await repositories.agentMemoryRepository.find({ withDeleted: true }))
      .map((memory) => memory.id)
      .sort()

  const deleteOne = (memoryId: string) =>
    request({
      route: DeskMemoriesRoutes.deleteOne,
      pathParams: { organizationId, projectId, agentId, memoryId },
      token: "token",
    })

  it("deleteOne removes the caller's fact for good", async () => {
    const { own, ownPlayground, others } = await createContext()

    const response = await deleteOne(own.id)

    expectSchemaResponse(DeskMemoriesRoutes.deleteOne, response)
    expect(response.body.data.success).toBe(true)
    expect(await remainingIds()).toEqual([ownPlayground.id, others.id].sort())
  })

  it("deleteOne cannot reach another user's fact", async () => {
    const { others } = await createContext()

    expectResponse(await deleteOne(others.id), 404)
    expect(await remainingIds()).toContain(others.id)
  })

  it("deleteOne cannot reach a fact of the caller's playground", async () => {
    const { ownPlayground } = await createContext()

    expectResponse(await deleteOne(ownPlayground.id), 404)
    expect(await remainingIds()).toContain(ownPlayground.id)
  })

  it("deleteOne cannot reach a fact of another agent", async () => {
    const { organization, project, user } = await createContext()
    const otherAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    const foreignFact = await repositories.agentMemoryRepository.save(
      agentMemoryFactory.transient({ organization, project, agent: otherAgent, user }).build(),
    )

    expectResponse(await deleteOne(foreignFact.id), 404)
    expect(await remainingIds()).toContain(foreignFact.id)
  })

  it("deleteOne answers 400 for a memory id that is not a UUID", async () => {
    await createContext()

    expectResponse(await deleteOne("not-a-uuid"), 400)
  })

  it("deleteOne answers 404 for an unknown memory", async () => {
    await createContext()

    expectResponse(await deleteOne(randomUUID()), 404)
  })

  it("deleteAll clears the caller's live memory only", async () => {
    const { ownPlayground, others } = await createContext()

    const response = await request({
      route: DeskMemoriesRoutes.deleteAll,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

    expectSchemaResponse(DeskMemoriesRoutes.deleteAll, response)
    expect(await remainingIds()).toEqual([ownPlayground.id, others.id].sort())
  })
})

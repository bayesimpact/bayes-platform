import { DeskMemoriesRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentMemoryFactory } from "@/domains/agents/memories/agent-memory.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk memories - getAll", () => {
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

  const createContext = async () => {
    const context = await createOrganizationWithAgent(repositories)
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject as string
    return context
  }

  const subject = async () =>
    request({
      route: DeskMemoriesRoutes.getAll,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })

  it("lists the caller's saved facts and pending proposals, oldest first", async () => {
    const { organization, project, agent, user } = await createContext()
    const memory = agentMemoryFactory.transient({ organization, project, agent, user })
    await repositories.agentMemoryRepository.save([
      memory.build({ content: "Prefers short answers", createdAt: new Date("2026-01-01") }),
      memory.pending().build({ content: "Works on weekends", createdAt: new Date("2026-01-02") }),
      memory.build({ content: "Playground fact", sessionType: "playground" }),
    ])

    const response = await subject()

    expectSchemaResponse(DeskMemoriesRoutes.getAll, response)
    expect(response.body.data.map((item) => [item.content, item.status])).toEqual([
      ["Prefers short answers", "saved"],
      ["Works on weekends", "pending"],
    ])
  })

  it("never returns another user's facts", async () => {
    const { organization, project, agent } = await createContext()
    const otherUser = await repositories.userRepository.save(userFactory.build())
    await repositories.agentMemoryRepository.save(
      agentMemoryFactory
        .transient({ organization, project, agent, user: otherUser })
        .build({ content: "Someone else's fact" }),
    )

    const response = await subject()

    expectSchemaResponse(DeskMemoriesRoutes.getAll, response)
    expect(response.body.data).toEqual([])
  })
})

import {
  AgentMemoriesRoutes,
  type ResolveAgentMemoryProposalsDto,
} from "@caseai-connect/api-contracts"
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

describe("Agent Memories - resolveProposals", () => {
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

  const createContext = async () => {
    const context = await createOrganizationWithAgent(repositories)
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject as string
    return context
  }

  const subject = (payload: ResolveAgentMemoryProposalsDto) =>
    request({
      route: AgentMemoriesRoutes.resolveProposals,
      pathParams: { organizationId, projectId, agentId, sessionType: "live" },
      token: "token",
      request: { payload },
    })

  it("saves approved proposals, with the user's rewording, and deletes rejected ones", async () => {
    const { organization, project, agent, user } = await createContext()
    const proposal = agentMemoryFactory.transient({ organization, project, agent, user }).pending()
    const kept = proposal.build({ content: "Likes bullet points" })
    const reworded = proposal.build({ content: "Works on weekends" })
    const rejected = proposal.build({ content: "Has a cat" })
    await repositories.agentMemoryRepository.save([kept, reworded, rejected])

    const response = await subject({
      decisions: [
        { memoryId: kept.id, decision: "save" },
        { memoryId: reworded.id, decision: "save", content: "Works on Saturdays" },
        { memoryId: rejected.id, decision: "reject" },
      ],
    })

    expectResponse(response, 200)
    expect(response.body.data.map((memory) => memory.content).sort()).toEqual([
      "Likes bullet points",
      "Works on Saturdays",
    ])
    const stored = await repositories.agentMemoryRepository.find({ withDeleted: true })
    expect(stored.map((memory) => [memory.content, memory.status]).sort()).toEqual([
      ["Likes bullet points", "saved"],
      ["Works on Saturdays", "saved"],
    ])
  })

  it("refuses a fact that is not one of the caller's pending proposals", async () => {
    const { organization, project, agent, user } = await createContext()
    const otherUser = await repositories.userRepository.save(userFactory.build())
    const alreadySaved = agentMemoryFactory
      .transient({ organization, project, agent, user })
      .build()
    const othersProposal = agentMemoryFactory
      .transient({ organization, project, agent, user: otherUser })
      .pending()
      .build()
    await repositories.agentMemoryRepository.save([alreadySaved, othersProposal])

    expectResponse(
      await subject({ decisions: [{ memoryId: alreadySaved.id, decision: "reject" }] }),
      404,
    )
    expectResponse(
      await subject({ decisions: [{ memoryId: othersProposal.id, decision: "save" }] }),
      404,
    )
    const stored = await repositories.agentMemoryRepository.find()
    expect(stored.map((memory) => memory.status).sort()).toEqual(["pending", "saved"])
  })

  it("validates the payload", async () => {
    await createContext()
    expectResponse(await subject({ decisions: [] }), 400)
  })
})

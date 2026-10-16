import { randomUUID } from "node:crypto"
import { AgentMemoriesRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  RandomUuid,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import {
  agentMembershipFactory,
  saveAgentMembership,
} from "@/domains/agents/memberships/agent-membership.factory"
import type { AgentMembershipRole } from "@/domains/agents/memberships/agent-membership.types"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.types"
import { mockForeignAuthSubject, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentMemoriesModule } from "../agent-memories.module"

describe("Agent Memories - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = RandomUuid.Organization
  let projectId: string | null = RandomUuid.Project
  let agentId: string | null = RandomUuid.Project
  let sessionType = "live"
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

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
    organizationId = RandomUuid.Organization
    projectId = RandomUuid.Project
    agentId = RandomUuid.Project
    sessionType = "live"
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const seedContext = async (options: {
    projectRole: ProjectMembershipRole
    agentMembership: AgentMembershipRole | "none"
  }) => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: { role: options.projectRole },
    })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    if (options.agentMembership !== "none") {
      await saveAgentMembership({
        repositories,
        membership: agentMembershipFactory
          .transient({ user, agent })
          .build({ role: options.agentMembership }),
      })
    }
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
  }

  const pathParams = () => removeNullish({ organizationId, projectId, agentId, sessionType })

  // One request at a time: the user guard creates the user on first sight.
  const subjects = async () => ({
    getAll: await request({
      route: AgentMemoriesRoutes.getAll,
      pathParams: pathParams(),
      token: accessToken ?? undefined,
    }),
    deleteAll: await request({
      route: AgentMemoriesRoutes.deleteAll,
      pathParams: pathParams(),
      token: accessToken ?? undefined,
    }),
    deleteOne: await request({
      route: AgentMemoriesRoutes.deleteOne,
      pathParams: { ...pathParams(), memoryId: randomUUID() },
      token: accessToken ?? undefined,
    }),
    resolve: await request({
      route: AgentMemoriesRoutes.resolveProposals,
      pathParams: pathParams(),
      token: accessToken ?? undefined,
      request: { payload: { decisions: [{ memoryId: randomUUID(), decision: "save" }] } },
    }),
  })

  /** deleteOne and resolveProposals target a memory that does not exist: 404 once authorized. */
  const expectAuthorized = async () => {
    const { getAll, deleteAll, deleteOne, resolve } = await subjects()
    expectResponse(getAll, 200)
    expectResponse(deleteAll, 200)
    expectResponse(deleteOne, 404)
    expectResponse(resolve, 404)
  }

  const expectAll = async (status: number, error?: string) => {
    const { getAll, deleteAll, deleteOne, resolve } = await subjects()
    expectResponse(getAll, status, error)
    expectResponse(deleteAll, status, error)
    expectResponse(deleteOne, status, error)
    expectResponse(resolve, status, error)
  }

  it("requires an authentication token", async () => {
    accessToken = null
    await expectAll(401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("requires the user to be a member of the organization", async () => {
    await createOrganizationWithAgent(repositories, { user: { authSubject } }).then(
      ({ organization, project, agent }) => {
        organizationId = organization.id
        projectId = project.id
        agentId = agent.id
      },
    )
    authSubject = mockForeignAuthSubject()
    await expectAll(401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
  })

  it("allows agent owners", async () => {
    await createOrganizationWithAgent(repositories, { user: { authSubject } }).then(
      ({ organization, project, agent }) => {
        organizationId = organization.id
        projectId = project.id
        agentId = agent.id
      },
    )
    await expectAuthorized()
  })

  it("allows project members who are agent members: the people who chat with it", async () => {
    await seedContext({ projectRole: "member", agentMembership: "member" })
    await expectAuthorized()
  })

  it("allows project owners, who can read every agent of the project", async () => {
    await seedContext({ projectRole: "owner", agentMembership: "none" })
    await expectAuthorized()
  })

  it("does not allow project members without access to the agent", async () => {
    await seedContext({ projectRole: "member", agentMembership: "none" })
    await expectAll(403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("requires an existing agent ID for the project", async () => {
    await seedContext({ projectRole: "owner", agentMembership: "owner" })
    agentId = randomUUID()
    await expectAll(404)
  })

  it("rejects an unknown session type", async () => {
    await seedContext({ projectRole: "owner", agentMembership: "owner" })
    sessionType = "public"
    await expectAll(400)
  })
})

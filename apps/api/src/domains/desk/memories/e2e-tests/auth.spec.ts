import { randomUUID } from "node:crypto"
import { DeskMemoriesRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import {
  agentMembershipFactory,
  saveAgentMembership,
} from "@/domains/agents/memberships/agent-membership.factory"
import type { AgentRoleKey } from "@/domains/agents/memberships/agent-membership.types"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { projectFactory } from "@/domains/projects/project.factory"
import { mockForeignAuthSubject, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk memories - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let agentId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

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
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const seedContext = async (options: {
    projectRole: ProjectRoleKey
    agentMembership: AgentRoleKey | "none"
  }) => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { authSubject },
      projectMembership: { roleKeys: [options.projectRole] },
    })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    if (options.agentMembership !== "none") {
      await saveAgentMembership({
        repositories,
        membership: agentMembershipFactory
          .transient({ user, agent })
          .withRoles(options.agentMembership)
          .build(),
      })
    }
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    return { organization, project, agent }
  }

  const agentParams = () => ({ organizationId, projectId, agentId })

  // One request at a time: the user guard creates the user on first sight.
  const subjects = async () => ({
    getAll: await request({
      route: DeskMemoriesRoutes.getAll,
      pathParams: agentParams(),
      token: accessToken,
    }),
    deleteAll: await request({
      route: DeskMemoriesRoutes.deleteAll,
      pathParams: agentParams(),
      token: accessToken,
    }),
    deleteOne: await request({
      route: DeskMemoriesRoutes.deleteOne,
      pathParams: { ...agentParams(), memoryId: randomUUID() },
      token: accessToken,
    }),
    resolve: await request({
      route: DeskMemoriesRoutes.resolveProposals,
      pathParams: agentParams(),
      token: accessToken,
      body: { payload: { decisions: [{ memoryId: randomUUID(), decision: "save" }] } },
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
    accessToken = undefined
    await expectAll(401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("requires the user to be a member of the organization", async () => {
    await seedContext({ projectRole: "project_owner", agentMembership: "agent_owner" })
    authSubject = mockForeignAuthSubject()
    await expectAll(401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
  })

  it("allows agent owners", async () => {
    const context = await createOrganizationWithAgent(repositories, { user: { authSubject } })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    await expectAuthorized()
  })

  it("allows project members who are agent members: the people who chat with it", async () => {
    await seedContext({ projectRole: "project_member", agentMembership: "agent_member" })
    await expectAuthorized()
  })

  it("allows project owners, who can read every agent of the project", async () => {
    await seedContext({ projectRole: "project_owner", agentMembership: "none" })
    await expectAuthorized()
  })

  it("does not allow project members without access to the agent", async () => {
    await seedContext({ projectRole: "project_member", agentMembership: "none" })
    await expectAll(403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  // As on the live route: an organization role grants no `agent.read`.
  it("forbids an organization admin who holds no project role", async () => {
    const { organization } = await seedContext({
      projectRole: "project_owner",
      agentMembership: "agent_owner",
    })
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: { authSubject: organizationAdminAuthSubject },
      membership: { roleKeys: ["org_admin"] },
    })
    authSubject = organizationAdminAuthSubject
    await expectAll(403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("answers 404 for an unknown agent", async () => {
    await seedContext({ projectRole: "project_owner", agentMembership: "agent_owner" })
    agentId = randomUUID()
    await expectAll(404)
  })

  it("answers 404 for an agent of another project", async () => {
    const { organization, agent } = await seedContext({
      projectRole: "project_owner",
      agentMembership: "agent_owner",
    })
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    projectId = otherProject.id
    agentId = agent.id
    await expectAll(404)
  })

  it("answers 400 for an agent id that is not a UUID", async () => {
    await seedContext({ projectRole: "project_owner", agentMembership: "agent_owner" })
    agentId = "not-a-uuid"
    await expectAll(400)
  })
})

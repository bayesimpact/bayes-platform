import { randomUUID } from "node:crypto"
import { AgentAnalyticsRoutes } from "@caseai-connect/api-contracts"
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
import type { AgentMembershipRole } from "@/domains/agents/memberships/agent-membership.entity"
import {
  agentMembershipFactory,
  saveAgentMembership,
} from "@/domains/agents/memberships/agent-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import type { ProjectMembershipRole } from "@/domains/projects/memberships/project-membership.entity"
import {
  projectMembershipFactory,
  saveProjectMembership,
} from "@/domains/projects/memberships/project-membership.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { mockForeignAuth0Id, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsAnalyticsModule } from "../agents-analytics.module"

describe("Agents Analytics - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = RandomUuid.Organization
  let projectId: string | null = RandomUuid.Project
  let agentId: string | null = RandomUuid.Project
  let accessToken: string | null = "token"
  let auth0Id = `auth0|${randomUUID()}`

  const dateRange = {
    startAt: new Date("2026-01-01T00:00:00.000Z").getTime(),
    endAt: new Date("2026-01-03T23:59:59.999Z").getTime(),
  }

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsAnalyticsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
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
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
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
      user: { auth0Id },
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
    accessToken = "token"
    return { organization, project, user, agent }
  }

  const seedAgentOwnerViaFactory = async () => {
    const { organization, project, user, agent } = await createOrganizationWithAgent(repositories, {
      user: { auth0Id },
    })
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    accessToken = "token"
    return { organization, project, user, agent }
  }

  const analyticsDateRangeQuery = {
    startAt: String(dateRange.startAt),
    endAt: String(dateRange.endAt),
  }

  const subjectConversations = async () =>
    request({
      route: AgentAnalyticsRoutes.getConversationsPerDay,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken ?? undefined,
      query: analyticsDateRangeQuery,
    })

  const subjectAvg = async () =>
    request({
      route: AgentAnalyticsRoutes.getAvgUserQuestionsPerSessionPerDay,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken ?? undefined,
      query: analyticsDateRangeQuery,
    })

  const subjectByCategoryPerDay = async () =>
    request({
      route: AgentAnalyticsRoutes.getConversationsByCategoryPerDay,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken ?? undefined,
      query: analyticsDateRangeQuery,
    })

  it("requires an authentication token", async () => {
    accessToken = null
    expectResponse(await subjectConversations(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await subjectAvg(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    expectResponse(await subjectByCategoryPerDay(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("requires a valid organization ID", async () => {
    organizationId = null
    expectResponse(await subjectConversations(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    expectResponse(await subjectAvg(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    expectResponse(await subjectByCategoryPerDay(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
  })

  it("requires the user to be a member of the organization", async () => {
    await seedAgentOwnerViaFactory()
    auth0Id = mockForeignAuth0Id()
    expectResponse(await subjectConversations(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    expectResponse(await subjectAvg(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    expectResponse(await subjectByCategoryPerDay(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
  })

  it("allows agent owners who are only project members", async () => {
    await createOrganizationWithAgent(repositories, {
      user: { auth0Id },
      projectMembership: { role: "member" },
    }).then(({ organization, project, agent }) => {
      organizationId = organization.id
      projectId = project.id
      agentId = agent.id
      accessToken = "token"
    })
    expectResponse(await subjectConversations(), 200)
    expectResponse(await subjectAvg(), 200)
    expectResponse(await subjectByCategoryPerDay(), 200)
  })

  it("allows agent owners who are project owners", async () => {
    await seedAgentOwnerViaFactory()
    expectResponse(await subjectConversations(), 200)
    expectResponse(await subjectAvg(), 200)
    expectResponse(await subjectByCategoryPerDay(), 200)
  })

  it("does not allow project owners without agent membership", async () => {
    await seedContext({ projectRole: "owner", agentMembership: "none" })
    expectResponse(await subjectConversations(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await subjectAvg(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await subjectByCategoryPerDay(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("allows project admins who are only agent admins", async () => {
    await seedContext({ projectRole: "admin", agentMembership: "admin" })
    expectResponse(await subjectConversations(), 200)
    expectResponse(await subjectAvg(), 200)
    expectResponse(await subjectByCategoryPerDay(), 200)
  })

  it("does not allow project members who are only agent members", async () => {
    await seedContext({ projectRole: "member", agentMembership: "member" })
    expectResponse(await subjectConversations(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await subjectAvg(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    expectResponse(await subjectByCategoryPerDay(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("requires an existing project ID", async () => {
    const { organization, user } = await seedAgentOwnerViaFactory()
    const otherProject = await repositories.projectRepository.save(
      projectFactory.transient({ organization }).build(),
    )
    const _otherProjectMembership = await saveProjectMembership({
      repositories,
      membership: projectMembershipFactory
        .owner()
        .transient({ user, project: otherProject })
        .build(),
    })
    projectId = otherProject.id
    expectResponse(await subjectConversations(), 404)
    expectResponse(await subjectAvg(), 404)
    expectResponse(await subjectByCategoryPerDay(), 404)
  })

  it("requires an existing agent ID for the project", async () => {
    await seedAgentOwnerViaFactory()
    agentId = randomUUID()
    expectResponse(await subjectConversations(), 404)
    expectResponse(await subjectAvg(), 404)
    expectResponse(await subjectByCategoryPerDay(), 404)
  })
})

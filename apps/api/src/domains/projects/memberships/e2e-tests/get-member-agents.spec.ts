import { ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
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
import {
  agentMembershipFactory,
  saveAgentMembership,
} from "@/domains/agents/memberships/agent-membership.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"

describe("Project membership - getMemberAgents", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let membershipId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
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

  const subject = async () =>
    request({
      route: ProjectMembershipRoutes.getMemberAgents,
      pathParams: removeNullish({ organizationId, projectId, membershipId }),
      token: accessToken,
    })

  it("should return one row per agent in the project with the user's role and status", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const ownerMembership = await repositories.userMembershipRepository.findOneOrFail({
      where: {
        resourceType: "project",
        resourceId: project.id,
        userId: user.id,
      },
    })
    membershipId = ownerMembership.id

    const agentWithMembership = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Agent A" }),
    )
    const agentWithoutMembership = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Agent B" }),
    )

    await saveAgentMembership({
      repositories,
      membership: agentMembershipFactory
        .transient({ agent: agentWithMembership, user })
        .build({ role: "admin" }),
    })

    const response = await subject()

    expectResponse(response, 200)
    const rows = response.body.data
    expect(rows).toHaveLength(2)

    const rowA = rows.find((row: { agentId: string }) => row.agentId === agentWithMembership.id)
    expect(rowA).toMatchObject({
      agentName: "Agent A",
      agentType: "conversation",
      role: "admin",
    })
    expect(rowA?.membershipId).toBeTruthy()

    const rowB = rows.find((row: { agentId: string }) => row.agentId === agentWithoutMembership.id)
    expect(rowB).toMatchObject({
      agentName: "Agent B",
      role: null,
      membershipId: null,
    })
  })

  it("should 404 when membershipId does not belong to the project", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id
    membershipId = "00000000-0000-0000-0000-000000000000"

    const response = await subject()
    expectResponse(response, 404)
  })
})

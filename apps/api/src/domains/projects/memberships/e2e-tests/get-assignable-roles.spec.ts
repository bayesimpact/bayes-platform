import { randomUUID } from "node:crypto"
import { ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"
import { addMemberByEmailToProject } from "../project-membership.factory"

describe("Project membership - getAssignableRoles", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let authSubject = "oidc|123"
  let _expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    _expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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

  /** A project owned by the caller, with two members who hold `project_member`. */
  const createContext = async () => {
    const { organization, project, user: owner } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = owner.authSubject!
    const addMember = async (email: string) =>
      (
        await addMemberByEmailToProject({
          repositories,
          organization,
          project,
          user: { email, authSubject: `oidc|${randomUUID()}` },
          projectMembership: { roleKeys: ["project_member"] },
        })
      ).addedUser
    const first = await addMember("first@example.com")
    const second = await addMember("second@example.com")
    return { organization, project, owner, first, second }
  }

  const _roleKeysOf = async (userId: string) => {
    const rows = await repositories.roleGrantRepository.find({
      where: { userId, resourceType: "project", resourceId: projectId },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  const _agentRoleKeysOf = async (userId: string) => {
    const rows = await repositories.roleGrantRepository.find({
      where: { userId, resourceType: "agent" },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  it("lists the roles a member can be given per kind of resource, in catalog order", async () => {
    await createContext()

    const response = await request({
      route: ProjectMembershipRoutes.getAssignableRoles,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
    })

    expectResponse(response, 200)
    const { project, agent, review_campaign } = response.body.data
    expect(project.map((role) => role.key)).toEqual(["project_admin", "project_member"])
    expect(project[0]?.name).toBe("Project Admin")
    // Owner roles are set at creation, and the conversation reviewer role is a backoffice grant.
    expect(agent.map((role) => role.key)).toEqual(["agent_admin", "agent_member"])
    expect(review_campaign.map((role) => role.key)).toEqual([
      "review_campaign_tester",
      "review_campaign_reviewer",
    ])
  })
})

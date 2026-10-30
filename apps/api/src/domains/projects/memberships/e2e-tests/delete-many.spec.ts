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
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"
import { addMemberByEmailToProject } from "../project-membership.factory"

describe("Project membership - deleteMany", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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

  const roleKeysOf = async (userId: string) => {
    const rows = await repositories.userMembershipRepository.find({
      where: { userId, resourceType: "project", resourceId: projectId },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  const agentRoleKeysOf = async (userId: string) => {
    const rows = await repositories.userMembershipRepository.find({
      where: { userId, resourceType: "agent" },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  const subject = (userIds: string[]) =>
    request({
      route: ProjectMembershipRoutes.deleteMany,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
      request: { payload: { userIds } },
    })

  it("removes every member listed, with their agent roles", async () => {
    const { organization, project, first, second } = await createContext()
    await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    await request({
      route: ProjectMembershipRoutes.addRoles,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
      request: { payload: { userIds: [first.id], roleKeys: ["project_admin"] } },
    })

    expectResponse(await subject([first.id, second.id]), 200)

    expect(await roleKeysOf(first.id)).toEqual([])
    expect(await roleKeysOf(second.id)).toEqual([])
    expect(await agentRoleKeysOf(first.id)).toEqual([])
    await expectActivityCreated("projectMembership.deleteMany")
  })

  it("refuses to remove the caller, and removes nobody", async () => {
    const { owner, first } = await createContext()

    expectResponse(
      await subject([first.id, owner.id]),
      403,
      "Cannot remove yourself from the project",
    )
    expect(await roleKeysOf(first.id)).toEqual(["project_member"])
  })

  it("refuses to remove every owner", async () => {
    const { owner, first, second } = await createContext()
    await request({
      route: ProjectMembershipRoutes.addRoles,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
      request: { payload: { userIds: [first.id], roleKeys: ["project_admin"] } },
    })
    authSubject = first.authSubject!

    expectResponse(
      await subject([owner.id, second.id]),
      403,
      "Cannot remove the last owner of the project",
    )
    expect(await roleKeysOf(second.id)).toEqual(["project_member"])
  })

  it("refuses everyone when one user is not a member", async () => {
    const { first } = await createContext()

    expectResponse(await subject([first.id, randomUUID()]), 404)
    expect(await roleKeysOf(first.id)).toEqual(["project_member"])
  })
})

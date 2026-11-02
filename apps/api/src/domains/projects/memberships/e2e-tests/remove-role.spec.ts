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

describe("Project membership - removeRole", () => {
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
    const rows = await repositories.roleGrantRepository.find({
      where: { userId, resourceType: "project", resourceId: projectId },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  const agentRoleKeysOf = async (userId: string) => {
    const rows = await repositories.roleGrantRepository.find({
      where: { userId, resourceType: "agent" },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  const subject = (userId: string, roleKey: string) =>
    request({
      route: ProjectMembershipRoutes.removeRole,
      pathParams: removeNullish({ organizationId, projectId, userId, roleKey }),
      token: "token",
    })

  const giveRole = async (userId: string, roleKey: string) => {
    const role = await repositories.roleRepository.findOneOrFail({ where: { key: roleKey } })
    await repositories.roleGrantRepository.save(
      repositories.roleGrantRepository.create({
        userId,
        resourceType: "project",
        resourceId: projectId,
        roleId: role.id,
      }),
    )
  }

  it("takes one role and returns the member with the others", async () => {
    const { first } = await createContext()
    await giveRole(first.id, "project_admin")

    const response = await subject(first.id, "project_member")

    expectResponse(response, 200)
    expect(response.body.data.roles.map((role) => role.key)).toEqual(["project_admin"])
    expect(await roleKeysOf(first.id)).toEqual(["project_admin"])
    await expectActivityCreated("projectMembership.removeRole")
  })

  it("turns the agent admin roles into member ones when the last managing role goes", async () => {
    const { organization, project, first } = await createContext()
    await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    await request({
      route: ProjectMembershipRoutes.addRoles,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
      request: { payload: { userIds: [first.id], roleKeys: ["project_admin"] } },
    })
    expect(await agentRoleKeysOf(first.id)).toEqual(["agent_admin"])

    expectResponse(await subject(first.id, "project_admin"), 200)

    expect(await agentRoleKeysOf(first.id)).toEqual(["agent_member"])
  })

  it("refuses to change the caller's own roles", async () => {
    const { owner } = await createContext()
    await giveRole(owner.id, "project_admin")

    expectResponse(await subject(owner.id, "project_admin"), 403, "Cannot change your own role")
  })

  it("refuses to take a member's last role", async () => {
    const { first } = await createContext()

    expectResponse(
      await subject(first.id, "project_member"),
      400,
      "A member keeps at least one role: remove the member instead",
    )
  })

  it("does not take the owner role", async () => {
    const { owner, first } = await createContext()
    await giveRole(owner.id, "project_admin")
    await giveRole(first.id, "project_admin")
    authSubject = first.authSubject!

    expectResponse(
      await subject(owner.id, "project_owner"),
      403,
      "The owner role is not given or taken here",
    )
  })

  it("answers 404 for a role the member does not hold", async () => {
    const { first } = await createContext()

    expectResponse(await subject(first.id, "project_admin"), 404)
  })
})

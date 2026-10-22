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

describe("Project membership - addRoles", () => {
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
          projectMembership: { role: "member" },
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

  const subject = (payload: { userIds: string[]; roleKeys: string[] }) =>
    request({
      route: ProjectMembershipRoutes.addRoles,
      pathParams: removeNullish({ organizationId, projectId }),
      token: "token",
      request: { payload },
    })

  it("gives the roles to every member listed and returns them", async () => {
    const { first, second } = await createContext()

    const response = await subject({
      userIds: [first.id, second.id],
      roleKeys: ["project_admin"],
    })

    expectResponse(response, 201)
    expect(
      response.body.data.map((member) => [
        member.userId,
        member.roles.map((role) => role.key).sort(),
      ]),
    ).toEqual(
      expect.arrayContaining([
        [first.id, ["project_admin", "project_member"]],
        [second.id, ["project_admin", "project_member"]],
      ]),
    )
    expect(await roleKeysOf(first.id)).toEqual(["project_admin", "project_member"])
    await expectActivityCreated("projectMembership.addRoles")
  })

  it("refuses the owner role, and changes nobody", async () => {
    const { first } = await createContext()

    expectResponse(
      await subject({ userIds: [first.id], roleKeys: ["project_owner"] }),
      403,
      "The owner role is not given or taken here",
    )
    expect(await roleKeysOf(first.id)).toEqual(["project_member"])
  })

  it("makes a new admin admin of every agent of the project", async () => {
    const { organization, project, first } = await createContext()
    await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )

    expectResponse(await subject({ userIds: [first.id], roleKeys: ["project_admin"] }), 201)

    expect(await agentRoleKeysOf(first.id)).toEqual(["agent_admin"])
  })

  it("refuses to change the caller's own roles, and changes nobody", async () => {
    const { owner, first } = await createContext()

    expectResponse(
      await subject({ userIds: [first.id, owner.id], roleKeys: ["project_admin"] }),
      403,
      "Cannot change your own role",
    )
    expect(await roleKeysOf(first.id)).toEqual(["project_member"])
  })

  it("refuses a role that is not a workspace role", async () => {
    const { first } = await createContext()

    expectResponse(
      await subject({ userIds: [first.id], roleKeys: ["agent_admin"] }),
      400,
      "Not a workspace role: agent_admin",
    )
  })

  it("refuses everyone when one user is not a member", async () => {
    const { first } = await createContext()

    expectResponse(
      await subject({ userIds: [first.id, randomUUID()], roleKeys: ["project_admin"] }),
      404,
    )
    expect(await roleKeysOf(first.id)).toEqual(["project_member"])
  })

  it("refuses an empty list of users", async () => {
    await createContext()

    expectResponse(await subject({ userIds: [], roleKeys: ["project_admin"] }), 400)
  })
})

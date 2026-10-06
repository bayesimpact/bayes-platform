import { randomUUID } from "node:crypto"
import {
  type EditableProjectMembershipRoleDto,
  ProjectMembershipRoutes,
} from "@caseai-connect/api-contracts"
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
import {
  agentMembershipFactory,
  saveAgentMembership,
} from "@/domains/agents/memberships/agent-membership.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { PROJECT_ROLE_PERMISSIONS } from "@/domains/rbac/rbac.constants"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"
import { addMemberByEmailToProject } from "../project-membership.factory"

describe("Project membership - updateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let membershipId: string
  let role: EditableProjectMembershipRoleDto = "admin"
  let accessToken: string | undefined = "token"
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
    accessToken = "token"
    authSubject = "oidc|123"
    role = "admin"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async ({
    targetRole = "member",
  }: {
    targetRole?: "owner" | "admin" | "member"
  } = {}) => {
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!

    const { membership, addedUser } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "teammate@example.com", authSubject: "oidc|teammate" },
      projectMembership: { role: targetRole },
    })
    membershipId = membership.id

    return { organization, project, user, addedUser, membership }
  }

  const subject = async () =>
    request({
      route: ProjectMembershipRoutes.updateOne,
      pathParams: removeNullish({ organizationId, projectId, membershipId }),
      token: accessToken,
      request: { payload: { role } },
    })

  const findStoredMembership = (id: string) =>
    repositories.userMembershipRepository.findOneOrFail({ where: { id } })

  it("promotes a member to admin and makes them admin of every agent", async () => {
    const { organization, project, addedUser } = await createContext()
    const agentWithMembership = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Agent A" }),
    )
    const agentWithoutMembership = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Agent B" }),
    )
    await saveAgentMembership({
      repositories,
      membership: agentMembershipFactory
        .transient({ agent: agentWithMembership, user: addedUser })
        .build({ role: "member" }),
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({ id: membershipId, role: "admin" })
    expect([...response.body.data.permissions].sort()).toEqual(
      [...PROJECT_ROLE_PERMISSIONS.project_admin].sort(),
    )

    const stored = await findStoredMembership(membershipId)
    expect(stored.role).toBe("admin")
    expect(stored.roleId).not.toBeNull()

    const agentMemberships = await repositories.userMembershipRepository.find({
      where: { userId: addedUser.id, resourceType: "agent" },
    })
    expect(
      agentMemberships.map((membership) => [membership.resourceId, membership.role]).sort(),
    ).toEqual(
      [
        [agentWithMembership.id, "admin"],
        [agentWithoutMembership.id, "admin"],
      ].sort(),
    )
    await expectActivityCreated("projectMembership.update")
  })

  it("demotes an admin to member and turns their admin agent memberships into member ones", async () => {
    const { organization, project, addedUser } = await createContext({ targetRole: "admin" })
    const adminAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Agent A" }),
    )
    const ownedAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Agent B" }),
    )
    await saveAgentMembership({
      repositories,
      membership: agentMembershipFactory
        .transient({ agent: adminAgent, user: addedUser })
        .build({ role: "admin" }),
    })
    await saveAgentMembership({
      repositories,
      membership: agentMembershipFactory
        .transient({ agent: ownedAgent, user: addedUser })
        .build({ role: "owner" }),
    })
    role = "member"

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({ id: membershipId, role: "member" })
    expect([...response.body.data.permissions].sort()).toEqual(
      [...PROJECT_ROLE_PERMISSIONS.project_member].sort(),
    )
    expect((await findStoredMembership(membershipId)).role).toBe("member")

    const agentMemberships = await repositories.userMembershipRepository.find({
      where: { userId: addedUser.id, resourceType: "agent" },
    })
    expect(
      agentMemberships.map((membership) => [membership.resourceId, membership.role]).sort(),
    ).toEqual(
      [
        [adminAgent.id, "member"],
        [ownedAgent.id, "owner"],
      ].sort(),
    )
  })

  it("leaves a membership that already has the role unchanged", async () => {
    await createContext({ targetRole: "admin" })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.role).toBe("admin")
  })

  it("refuses to change the owner's role", async () => {
    const { organization, project, user } = await createContext()
    const ownerMembership = await repositories.userMembershipRepository.findOneOrFail({
      where: { resourceType: "project", resourceId: project.id, userId: user.id },
    })
    membershipId = ownerMembership.id
    // An admin tries to demote the owner
    const { addedUser } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "admin@example.com", authSubject: "oidc|admin" },
      projectMembership: { role: "admin" },
    })
    authSubject = addedUser.authSubject!
    role = "member"

    expectResponse(await subject(), 403, "Cannot change the role of the project owner")
    expect((await findStoredMembership(membershipId)).role).toBe("owner")
  })

  it("refuses to let an admin change their own role", async () => {
    const { addedUser } = await createContext({ targetRole: "admin" })
    authSubject = addedUser.authSubject!
    role = "member"

    expectResponse(await subject(), 403, "Cannot change your own role")
    expect((await findStoredMembership(membershipId)).role).toBe("admin")
  })

  it("refuses to make someone owner", async () => {
    await createContext()
    role = "owner" as EditableProjectMembershipRoleDto

    expectResponse(await subject(), 400, "Role must be admin or member")
    expect((await findStoredMembership(membershipId)).role).toBe("member")
  })

  it("returns 404 for a membership of another project", async () => {
    await createContext()
    membershipId = randomUUID()

    expectResponse(await subject(), 404)
  })
})

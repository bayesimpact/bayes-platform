import { InvitationsRoutes } from "@caseai-connect/api-contracts"
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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { agentMembershipFactory } from "../../agents/memberships/agent-membership.factory"
import { projectMembershipFactory } from "../../projects/memberships/project-membership.factory"
import { InvitationsModule } from "../invitations.module"

describe("Invitations — listPendingMine", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule],
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
      route: InvitationsRoutes.listPendingMine,
      token: accessToken,
    })

  it("requires an authentication token", async () => {
    accessToken = undefined
    expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("returns empty invitations when the user has none", async () => {
    const { user } = await createOrganizationWithProject(repositories)
    auth0Id = user.auth0Id
    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.invitations).toEqual([])
  })

  it("returns pending project and agent invitations with org/project/agent context", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    auth0Id = user.auth0Id

    const pendingProject = projectFactory
      .transient({ organization })
      .build({ name: "Pending Project" })
    await repositories.projectRepository.save(pendingProject)
    const pendingProjectMembership = projectMembershipFactory
      .admin()
      .transient({ project: pendingProject, user })
      .build({ status: "sent" })
    await repositories.projectMembershipRepository.save(pendingProjectMembership)
    await repositories.invitationRepository.save(
      repositories.invitationRepository.create({
        organizationId: organization.id,
        projectId: pendingProject.id,
        targetType: "project",
        targetId: pendingProject.id,
        userId: user.id,
        invitedEmail: user.email,
        invitationToken: pendingProjectMembership.invitationToken,
        status: "pending",
        role: pendingProjectMembership.role,
        invitedAt: pendingProjectMembership.createdAt,
        acceptedAt: null,
      }),
    )

    const pendingAgent = agentFactory
      .transient({ organization, project })
      .build({ name: "Pending Agent", type: "conversation" })
    await repositories.agentRepository.save(pendingAgent)
    const pendingAgentMembership = agentMembershipFactory
      .member()
      .transient({ agent: pendingAgent, user })
      .build({ status: "sent" })
    await repositories.agentMembershipRepository.save(pendingAgentMembership)
    await repositories.invitationRepository.save(
      repositories.invitationRepository.create({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "agent",
        targetId: pendingAgent.id,
        userId: user.id,
        invitedEmail: user.email,
        invitationToken: pendingAgentMembership.invitationToken,
        status: "pending",
        role: pendingAgentMembership.role,
        invitedAt: pendingAgentMembership.createdAt,
        acceptedAt: null,
      }),
    )

    const acceptedAgent = agentFactory
      .transient({ organization, project })
      .build({ name: "Accepted Agent", type: "conversation" })
    await repositories.agentRepository.save(acceptedAgent)
    const acceptedAgentMembership = agentMembershipFactory
      .member()
      .transient({ agent: acceptedAgent, user })
      .build({ status: "accepted" })
    await repositories.agentMembershipRepository.save(acceptedAgentMembership)

    const response = await subject()
    expectResponse(response, 200)

    const { invitations } = response.body.data
    expect(invitations).toHaveLength(2)

    const projectInvite = invitations.find((i) => i.targetType === "project")
    expect(projectInvite).toMatchObject({
      projectId: pendingProject.id,
      targetId: pendingProject.id,
      organizationId: organization.id,
      organizationName: organization.name,
      projectName: "Pending Project",
      targetName: "Pending Project",
      role: "admin",
      invitationToken: pendingProjectMembership.invitationToken,
      status: "pending",
    })

    const agentInvite = invitations.find((i) => i.targetType === "agent")
    expect(agentInvite).toMatchObject({
      projectId: project.id,
      targetId: pendingAgent.id,
      organizationId: organization.id,
      organizationName: organization.name,
      projectName: project.name,
      targetName: "Pending Agent",
      role: "member",
      invitationToken: pendingAgentMembership.invitationToken,
      status: "pending",
    })
  })

  it("does not leak invitations sent to other users", async () => {
    const { user, project } = await createOrganizationWithProject(repositories)
    auth0Id = user.auth0Id

    const otherUser = userFactory.build()
    await repositories.userRepository.save(otherUser)
    const otherMembership = projectMembershipFactory
      .member()
      .transient({ project, user: otherUser })
      .build({ status: "sent" })
    await repositories.projectMembershipRepository.save(otherMembership)
    await repositories.invitationRepository.save(
      repositories.invitationRepository.create({
        organizationId: project.organizationId,
        projectId: project.id,
        targetType: "project",
        targetId: project.id,
        userId: otherUser.id,
        invitedEmail: otherUser.email,
        invitationToken: otherMembership.invitationToken,
        status: "pending",
        role: otherMembership.role,
        invitedAt: otherMembership.createdAt,
        acceptedAt: null,
      }),
    )

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.invitations).toEqual([])
  })
})

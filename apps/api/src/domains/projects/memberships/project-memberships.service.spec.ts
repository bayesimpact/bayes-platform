import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { grantConversationReview } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewer.factory"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithOwner,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { AGENT_CONVERSATION_REVIEWER_ROLE, PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
import { userFactory } from "@/domains/users/user.factory"
import { USER_TYPE_SERVICE } from "@/domains/users/user.types"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { projectFactory } from "../project.factory"
import { ProjectsModule } from "../projects.module"
import { addUserToProject } from "./project-membership.factory"
import { ProjectMembershipsService } from "./project-memberships.service"

describe("ProjectMembershipsService", () => {
  let service: ProjectMembershipsService
  let repositories: AllRepositories
  let agentMembershipsService: AgentMembershipsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [ProjectsModule] })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    service = setup.module.get(ProjectMembershipsService)
    agentMembershipsService = setup.module.get(AgentMembershipsService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  describe("createProjectOwnerMembership", () => {
    it("creates an owner membership", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const project = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )

      const membership = await service.createProjectOwnerMembership({
        projectId: project.id,
        userId: user.id,
      })

      expect(membership.roles.map((role) => role.key)).toEqual(["project_owner"])

      // the RBAC role backing the membership is resolved at write time
      const savedMembership = await repositories.userMembershipRepository.findOneOrFail({
        where: { id: membership.id },
      })
      const projectOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: PROJECT_ROLES.owner },
      })
      expect(savedMembership.roleId).toBe(projectOwnerRole.id)
    })
  })

  describe("listProjectMemberships", () => {
    it("returns memberships ordered by createdAt DESC", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const firstUser = await repositories.userRepository.save(userFactory.build())
      const secondUser = await repositories.userRepository.save(userFactory.build())

      await addUserToProject({
        repositories,
        project,
        user: firstUser,
        membership: { createdAt: new Date("2025-01-01T10:00:00.000Z") },
      })
      await addUserToProject({
        repositories,
        project,
        user: secondUser,
        membership: { createdAt: new Date("2025-01-01T11:00:00.000Z") },
      })

      const memberships = await service.listProjectMemberships(project.id)
      const timestamps = memberships.map((membership) => membership.createdAt.getTime())
      const sortedDescending = [...timestamps].sort((left, right) => right - left)
      expect(timestamps).toEqual(sortedDescending)
    })

    it("hides service users from the project member list", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)
      const serviceUser = await repositories.userRepository.save(
        userFactory.build({
          type: USER_TYPE_SERVICE,
          email: "app+install@service.bayes.internal",
          authSubject: "service|project-list",
        }),
      )
      await addUserToProject({ repositories, project, user: serviceUser })

      const memberships = await service.listProjectMemberships(project.id)
      expect(memberships.map((membership) => membership.userId)).toContain(user.id)
      expect(memberships.map((membership) => membership.userId)).not.toContain(serviceUser.id)
    })
  })

  describe("upsertProjectAdminMembership", () => {
    it("creates an admin membership when missing", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const invitedUser = await repositories.userRepository.save(userFactory.build())

      const created = await service.upsertProjectAdminMembership({
        projectId: project.id,
        userId: invitedUser.id,
      })

      expect(created).not.toBeNull()
      expect(created?.roles.map((role) => role.key)).toEqual(["project_admin"])
    })

    it("promotes existing non-admin membership and syncs agent admins", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const invitedUser = await repositories.userRepository.save(userFactory.build())
      await addUserToProject({
        repositories,
        project,
        user: invitedUser,
        membership: { role: "member" },
      })
      const createAdminAgentMembershipsSpy = jest
        .spyOn(agentMembershipsService, "createAdminAgentMembershipsForUserInProject")
        .mockResolvedValue()

      const result = await service.upsertProjectAdminMembership({
        projectId: project.id,
        userId: invitedUser.id,
      })

      expect(result).toBeNull()
      const updatedMembership = await repositories.userMembershipRepository.findOneOrFail({
        where: {
          userId: invitedUser.id,
          resourceType: "project",
          resourceId: project.id,
        },
        relations: { rbacRole: true },
      })
      expect(updatedMembership.rbacRole?.key).toBe("project_admin")
      expect(createAdminAgentMembershipsSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe("removeProjectMembership", () => {
    it("rejects removing yourself", async () => {
      const { project, user, projectMembership } = await createOrganizationWithProject(repositories)

      await expect(
        service.removeProjectMembership({
          userId: user.id,
          membershipId: projectMembership.id,
          projectId: project.id,
        }),
      ).rejects.toThrow("Cannot remove yourself from the project")
    })

    it("deletes a never-signed-in user when their last membership is removed", async () => {
      const { project, user: actorUser } = await createOrganizationWithProject(repositories)
      const placeholderUser = await repositories.userRepository.save(
        userFactory.build({
          authSubject: null,
        }),
      )
      const { membership } = await addUserToProject({
        repositories,
        project,
        user: placeholderUser,
        membership: { role: "admin" },
      })
      const deleteAgentMembershipsSpy = jest
        .spyOn(agentMembershipsService, "deleteAgentMembershipsForUserInProject")
        .mockResolvedValue()

      await service.removeProjectMembership({
        userId: actorUser.id,
        membershipId: membership.id,
        projectId: project.id,
      })

      const deletedMembership = await repositories.userMembershipRepository.findOne({
        where: { id: membership.id },
      })
      const deletedUser = await repositories.userRepository.findOne({
        where: { id: placeholderUser.id },
      })
      expect(deletedMembership).toBeNull()
      expect(deletedUser).toBeNull()
      expect(deleteAgentMembershipsSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe("several roles on one project", () => {
    const giveRole = async ({
      userId,
      projectId,
      roleKey,
    }: {
      userId: string
      projectId: string
      roleKey: string
    }) => {
      const role = await repositories.roleRepository.findOneOrFail({ where: { key: roleKey } })
      return repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          userId,
          resourceType: "project",
          resourceId: projectId,
          roleId: role.id,
        }),
      )
    }

    const roleKeysOf = (membership: { roles: { key: string }[] } | null) =>
      membership?.roles.map((role) => role.key) ?? []

    it("lists one membership per person, with every role they hold, oldest row as id", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const { membership } = await addUserToProject({
        repositories,
        project,
        membership: { role: "member" },
      })
      await giveRole({
        userId: membership.userId,
        projectId: project.id,
        roleKey: PROJECT_ROLES.admin,
      })

      const memberships = await service.listProjectMemberships(project.id)

      const member = memberships.find((candidate) => candidate.userId === membership.userId)
      expect(memberships).toHaveLength(2)
      expect(member?.id).toBe(membership.id)
      expect(roleKeysOf(member ?? null)).toEqual([PROJECT_ROLES.admin, PROJECT_ROLES.member])
    })

    it("finds the person's membership from any of their rows", async () => {
      const { project } = await createOrganizationWithProject(repositories)
      const { membership } = await addUserToProject({ repositories, project })
      const adminRow = await giveRole({
        userId: membership.userId,
        projectId: project.id,
        roleKey: PROJECT_ROLES.admin,
      })

      const found = await service.findProjectMembership({
        userId: membership.userId,
        projectId: project.id,
      })
      const { membership: updated } = await service.updateProjectMembershipRole({
        callerUserId: (await createOrganizationWithOwner(repositories)).user.id,
        membershipId: adminRow.id,
        projectId: project.id,
        role: "admin",
      })

      expect(found?.id).toBe(membership.id)
      // admin + member collapse into admin: the member row is the one that goes
      expect(roleKeysOf(updated)).toEqual([PROJECT_ROLES.admin])
    })

    it("adds admin next to ownership when an owner is made admin", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)

      await service.upsertProjectAdminMembership({ projectId: project.id, userId: user.id })

      const membership = await service.findProjectMembership({
        userId: user.id,
        projectId: project.id,
      })
      expect(roleKeysOf(membership)).toEqual([PROJECT_ROLES.owner, PROJECT_ROLES.admin])
    })

    it("removes every role of the person, and their agent roles, but not their review grants", async () => {
      const { project, user: owner, agent } = await createOrganizationWithAgent(repositories)
      const { membership, user: member } = await addUserToProject({
        repositories,
        project,
        membership: { role: "member" },
      })
      await giveRole({ userId: member.id, projectId: project.id, roleKey: PROJECT_ROLES.admin })
      await addUserToAgent({ repositories, agent, user: member, membership: { role: "admin" } })
      await grantConversationReview({ repositories, user: member, agent })

      await service.removeProjectMembership({
        userId: owner.id,
        membershipId: membership.id,
        projectId: project.id,
      })

      const remainingRows = await repositories.userMembershipRepository.find({
        where: { userId: member.id },
        relations: { rbacRole: true },
      })
      expect(remainingRows.map((row) => row.rbacRole?.key)).toEqual([
        AGENT_CONVERSATION_REVIEWER_ROLE,
      ])
    })

    it("refuses to remove the last owner, and removes one of two owners", async () => {
      const { project, user: owner } = await createOrganizationWithProject(repositories)
      const { membership: coOwnerMembership, user: coOwner } = await addUserToProject({
        repositories,
        project,
        membership: { role: "owner" },
      })
      const ownerMembership = await service.findProjectMembership({
        userId: owner.id,
        projectId: project.id,
      })

      await service.removeProjectMembership({
        userId: owner.id,
        membershipId: coOwnerMembership.id,
        projectId: project.id,
      })
      await expect(
        service.findProjectMembership({ userId: coOwner.id, projectId: project.id }),
      ).resolves.toBeNull()

      const { user: admin } = await addUserToProject({
        repositories,
        project,
        membership: { role: "admin" },
      })
      await expect(
        service.removeProjectMembership({
          userId: admin.id,
          membershipId: ownerMembership?.id ?? "",
          projectId: project.id,
        }),
      ).rejects.toThrow("Cannot remove the last owner of the project")
    })
  })
})

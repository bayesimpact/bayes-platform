import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import {
  createOrganizationWithOwner,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { projectFactory } from "../project.factory"
import { ProjectsModule } from "../projects.module"
import { addUserToProject } from "./project-membership.factory"
import {
  PLACEHOLDER_AUTH0_ID_PREFIX,
  ProjectMembershipsService,
} from "./project-memberships.service"

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

      expect(membership.role).toBe("owner")

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
      expect(created?.role).toBe("admin")
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
      })
      expect(updatedMembership.role).toBe("admin")
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

    it("deletes placeholder user when membership is removed", async () => {
      const { project, user: actorUser } = await createOrganizationWithProject(repositories)
      const placeholderUser = await repositories.userRepository.save(
        userFactory.build({
          auth0Id: `${PLACEHOLDER_AUTH0_ID_PREFIX}test-placeholder`,
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
})

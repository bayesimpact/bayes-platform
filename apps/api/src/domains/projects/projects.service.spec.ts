import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import {
  createOrganizationWithOwner,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { addUserToProject } from "./memberships/project-membership.factory"
import { projectFactory } from "./project.factory"
import { ProjectsModule } from "./projects.module"
import { ProjectsService } from "./projects.service"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue(undefined),
}

describe("ProjectsService", () => {
  let service: ProjectsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
      applyOverrides: (moduleBuilder) =>
        moduleBuilder.overrideProvider(INVITATION_SENDER).useValue(mockInvitationSender),
    })
    await clearTestDatabase(setup.dataSource)
    repositories = setup.getAllRepositories()
    service = setup.module.get<ProjectsService>(ProjectsService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  afterEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  describe("createProject", () => {
    it("should create a project", async () => {
      // Arrange
      const { organization, user } = await createOrganizationWithOwner(repositories)

      // Act
      const result = await service.createProject({
        organizationId: organization.id,
        name: "New Project",
        userId: user.id,
      })

      // Assert
      expect(result.name).toBe("New Project")
      expect(result.organizationId).toBe(organization.id)
      expect(result.id).toBeDefined()

      const savedProject = await repositories.projectRepository.findOne({
        where: { id: result.id },
      })
      expect(savedProject).not.toBeNull()
      expect(savedProject?.name).toBe("New Project")
    })

    it("should seed the public-documents tag for the new project", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      const result = await service.createProject({
        organizationId: organization.id,
        name: "New Project",
        userId: user.id,
      })

      const documentTags = await setup.getRepository(DocumentTag).find({
        where: { projectId: result.id },
      })
      expect(documentTags).toHaveLength(1)
      expect(documentTags[0]?.name).toBe(PUBLIC_DOCUMENTS_TAG_NAME)
      expect(documentTags[0]?.parentId).toBeNull()
    })
  })

  describe("listProjects", () => {
    it("should return projects for an organization", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      const project1 = projectFactory.transient({ organization }).build({
        name: "Project 1",
      })
      const project2 = projectFactory.transient({ organization }).build({
        name: "Project 2",
      })
      await repositories.projectRepository.save([project1, project2])

      await addUserToProject({ repositories, project: project1, user })
      await addUserToProject({ repositories, project: project2, user })

      const result = await service.listProjects({
        organizationId: organization.id,
        userId: user.id,
      })

      expect(result).toHaveLength(2)
      expect(result.map((project) => project.name)).toContain("Project 1")
      expect(result.map((project) => project.name)).toContain("Project 2")
    })

    it("should return empty array when user has no project membership", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const project = projectFactory.transient({ organization }).build()
      await repositories.projectRepository.save(project)
      const result = await service.listProjects({
        organizationId: organization.id,
        userId: user.id,
      })
      expect(result).toEqual([])
    })
  })

  describe("deleteProject", () => {
    it("should delete a project", async () => {
      const { project } = await createOrganizationWithProject(repositories)

      await service.deleteProject(project)

      const deletedProject = await repositories.projectRepository.findOne({
        where: { id: project.id },
      })
      expect(deletedProject).toBeNull()
    })

    it("should soft-delete project memberships when deleting a project", async () => {
      const { project } = await createOrganizationWithProject(repositories)

      await service.deleteProject(project)

      const activeMemberships = await repositories.userMembershipRepository.find({
        where: { resourceType: "project", resourceId: project.id },
      })
      expect(activeMemberships).toHaveLength(0)

      const softDeletedMemberships = await repositories.userMembershipRepository.find({
        where: { resourceType: "project", resourceId: project.id },
        withDeleted: true,
      })
      expect(softDeletedMemberships.length).toBeGreaterThan(0)
      expect(softDeletedMemberships.every((membership) => membership.deletedAt !== null)).toBe(true)
    })

    it("should soft-delete memberships for users other than the project owner", async () => {
      const { project, user: owner } = await createOrganizationWithProject(repositories)
      const member = await repositories.userRepository.save(userFactory.build())
      await addUserToProject({ repositories, project, user: member })

      await service.deleteProject(project)

      for (const userId of [owner.id, member.id]) {
        const activeMembership = await repositories.userMembershipRepository.findOne({
          where: { userId, resourceType: "project", resourceId: project.id },
        })
        const softDeletedMembership = await repositories.userMembershipRepository.findOne({
          where: { userId, resourceType: "project", resourceId: project.id },
          withDeleted: true,
        })
        expect(activeMembership).toBeNull()
        expect(softDeletedMembership?.deletedAt).not.toBeNull()
      }
    })
  })

  describe("hasFeature", () => {
    it("should return true when the organization has the feature flag enabled", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      await repositories.featureFlagRepository.save(
        repositories.featureFlagRepository.create({
          projectId: project.id,
          featureFlagKey: "sources-tool",
          enabled: true,
        }),
      )

      const result = await service.hasFeature({
        connectScope: { organizationId: organization.id, projectId: project.id },
        feature: "sources-tool",
      })

      expect(result).toBe(true)
    })

    it("should return false when the organization does not have the feature flag", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)

      const result = await service.hasFeature({
        connectScope: { organizationId: organization.id, projectId: project.id },
        feature: "evaluation",
      })

      expect(result).toBe(false)
    })
  })
})

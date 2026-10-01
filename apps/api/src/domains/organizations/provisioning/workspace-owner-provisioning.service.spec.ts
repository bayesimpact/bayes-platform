import { clearTestDatabase } from "@/common/test/test-database"
import {
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { TransactionService } from "@/common/transaction/transaction.service"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { userFactory } from "@/domains/users/user.factory"
import { WorkspaceOwnerProvisioningService } from "./workspace-owner-provisioning.service"

describe("WorkspaceOwnerProvisioningService", () => {
  let service: WorkspaceOwnerProvisioningService
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let userRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["userRepository"]
  let organizationRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["organizationRepository"]
  let projectRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["projectRepository"]
  let userMembershipRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["userMembershipRepository"]

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [OrganizationsModule, MembershipsModule, ProjectsModule],
    })
    const repositories = setup.getAllRepositories()
    userRepository = repositories.userRepository
    organizationRepository = repositories.organizationRepository
    userMembershipRepository = repositories.userMembershipRepository
    projectRepository = repositories.projectRepository
    const organizationMembershipsService = setup.module.get(OrganizationMembershipsService)
    const projectMembershipsService = setup.module.get(ProjectMembershipsService)
    const transactionService = setup.module.get(TransactionService)
    service = new WorkspaceOwnerProvisioningService(
      setup.dataSource,
      organizationMembershipsService,
      projectMembershipsService,
      transactionService,
    )
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
  })

  describe("provisionWorkspaceOwner", () => {
    it("should create the org, the project, a never-signed-in user and admin memberships", async () => {
      const result = await service.provisionWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "New Org",
        fullName: "New Owner",
      })

      expect(result.status).toBe("granted")
      expect(result.email).toBe("owner@example.com")
      expect(result.organizationName).toBe("New Org")

      const organization = await organizationRepository.findOne({
        where: { id: result.organizationId },
      })
      expect(organization).toBeDefined()
      expect(organization!.name).toBe("New Org")

      const project = await projectRepository.findOne({
        where: { id: result.projectId },
      })
      expect(project).toBeDefined()
      expect(project!.name).toBe("New Org")
      expect(project!.organizationId).toBe(result.organizationId)

      const orgMembership = await userMembershipRepository.findOne({
        where: {
          userId: result.userId,
          resourceId: result.organizationId,
          resourceType: "organization",
        },
      })
      expect(orgMembership).toBeDefined()
      expect(orgMembership!.role).toBe("admin")

      const projectMembership = await userMembershipRepository.findOne({
        where: {
          userId: result.userId,
          resourceId: result.projectId,
          resourceType: "project",
        },
      })
      expect(projectMembership?.role).toBe("admin")

      const user = await userRepository.findOne({ where: { id: result.userId } })
      expect(user?.authSubject).toBeNull()
      expect(user?.name).toBe("New Owner")
    })

    it("should reuse existing organization by case-insensitive name", async () => {
      const existingOrg = organizationFactory.build({ name: "Existing Org" })
      await organizationRepository.save(existingOrg)

      const result = await service.provisionWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "existing org",
      })

      expect(result.status).toBe("granted")
      expect(result.organizationId).toBe(existingOrg.id)
    })

    it("should reuse existing user by email", async () => {
      const existingUser = userFactory.build({ email: "owner@example.com" })
      await userRepository.save(existingUser)

      const result = await service.provisionWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "New Org",
      })

      expect(result.status).toBe("granted")
      expect(result.userId).toBe(existingUser.id)
    })

    it("should skip when user already has a project membership in the organization", async () => {
      const existingUser = userFactory.build({ email: "owner@example.com" })
      await userRepository.save(existingUser)

      const existingOrg = organizationFactory.build({ name: "Test Org" })
      await organizationRepository.save(existingOrg)

      const project = projectRepository.create({
        organizationId: existingOrg.id,
        name: "Test Org",
      })
      await projectRepository.save(project)

      await userMembershipRepository.save(
        userMembershipFactory.build({
          userId: existingUser.id,
          resourceId: project.id,
          resourceType: "project",
          role: "admin",
        }),
      )

      const result = await service.provisionWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "Test Org",
      })

      expect(result.status).toBe("skipped_existing_membership")
    })

    it("should reuse existing project in the organization", async () => {
      const existingOrg = organizationFactory.build({ name: "Test Org" })
      await organizationRepository.save(existingOrg)

      const existingProject = projectRepository.create({
        organizationId: existingOrg.id,
        name: "Existing Project",
      })
      await projectRepository.save(existingProject)

      const result = await service.provisionWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "Test Org",
      })

      expect(result.status).toBe("granted")
      expect(result.projectId).toBe(existingProject.id)
    })
  })

  describe("previewProvisioning", () => {
    it("should return would_grant for new user", async () => {
      const result = await service.previewProvisioning({
        email: "new@example.com",
        organizationName: "New Org",
      })

      expect(result.status).toBe("would_grant")
    })

    it("should return would_skip_existing_membership when user has project membership in org", async () => {
      const existingUser = userFactory.build({ email: "owner@example.com" })
      await userRepository.save(existingUser)

      const existingOrg = organizationFactory.build({ name: "Test Org" })
      await organizationRepository.save(existingOrg)

      const project = projectRepository.create({
        organizationId: existingOrg.id,
        name: "Test Org",
      })
      await projectRepository.save(project)

      await userMembershipRepository.save(
        userMembershipFactory.build({
          userId: existingUser.id,
          resourceId: project.id,
          resourceType: "project",
          role: "admin",
        }),
      )

      const result = await service.previewProvisioning({
        email: "owner@example.com",
        organizationName: "Test Org",
      })

      expect(result.status).toBe("would_skip_existing_membership")
    })
  })
})

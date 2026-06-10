import { getDataSourceToken } from "@nestjs/typeorm"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { userFactory } from "@/domains/users/user.factory"
import { WorkspaceInvitationService } from "./workspace-invitation.service"

describe("WorkspaceInvitationService", () => {
  let service: WorkspaceInvitationService
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let userRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["userRepository"]
  let organizationRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["organizationRepository"]
  let organizationMembershipRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["organizationMembershipRepository"]
  let projectRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["projectRepository"]
  let projectMembershipRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["projectMembershipRepository"]
  let invitationRepository: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >["invitationRepository"]

  const mockInvitationSender = {
    sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket_abc123" }),
  }

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [OrganizationsModule],
    })
    const repositories = setup.getAllRepositories()
    userRepository = repositories.userRepository
    organizationRepository = repositories.organizationRepository
    organizationMembershipRepository = repositories.organizationMembershipRepository
    projectRepository = repositories.projectRepository
    projectMembershipRepository = repositories.projectMembershipRepository
    invitationRepository = repositories.invitationRepository
    const dataSource = setup.module.get(getDataSourceToken())
    service = new WorkspaceInvitationService(mockInvitationSender, dataSource)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
    mockInvitationSender.sendInvitation.mockResolvedValue({ ticketId: "ticket_abc123" })
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
  })

  describe("inviteWorkspaceOwner", () => {
    it("should create org, project, placeholder user, and memberships", async () => {
      const result = await service.inviteWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "New Org",
        inviterName: "Admin",
        fullName: "New Owner",
      })

      expect(result.status).toBe("invited")
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

      const orgMembership = await organizationMembershipRepository.findOne({
        where: { userId: result.userId, organizationId: result.organizationId },
      })
      expect(orgMembership).toBeDefined()
      expect(orgMembership!.role).toBe("admin")

      const invitation = await invitationRepository.findOne({
        where: { userId: result.userId, projectId: result.projectId },
      })
      expect(invitation).toBeDefined()
      expect(invitation!.role).toBe("admin")
      expect(invitation!.status).toBe("pending")
      expect(invitation!.invitationToken).toBe("ticket_abc123")
    })

    it("should reuse existing organization by case-insensitive name", async () => {
      const existingOrg = organizationFactory.build({ name: "Existing Org" })
      await organizationRepository.save(existingOrg)

      const result = await service.inviteWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "existing org",
        inviterName: "Admin",
      })

      expect(result.status).toBe("invited")
      expect(result.organizationId).toBe(existingOrg.id)
    })

    it("should reuse existing user by email", async () => {
      const existingUser = userFactory.build({ email: "owner@example.com" })
      await userRepository.save(existingUser)

      const result = await service.inviteWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "New Org",
        inviterName: "Admin",
      })

      expect(result.status).toBe("invited")
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

      await projectMembershipRepository.save(
        projectMembershipRepository.create({
          projectId: project.id,
          userId: existingUser.id,
          role: "admin",
        }),
      )

      const result = await service.inviteWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "Test Org",
        inviterName: "Admin",
      })

      expect(result.status).toBe("skipped_existing_membership")
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("should send invitation via Auth0", async () => {
      await service.inviteWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "New Org",
        inviterName: "Admin Team",
      })

      expect(mockInvitationSender.sendInvitation).toHaveBeenCalledWith({
        inviteeEmail: "owner@example.com",
        inviterName: "Admin Team",
      })
    })

    it("should reuse existing project in the organization", async () => {
      const existingOrg = organizationFactory.build({ name: "Test Org" })
      await organizationRepository.save(existingOrg)

      const existingProject = projectRepository.create({
        organizationId: existingOrg.id,
        name: "Existing Project",
      })
      await projectRepository.save(existingProject)

      const result = await service.inviteWorkspaceOwner({
        email: "owner@example.com",
        organizationName: "Test Org",
        inviterName: "Admin",
      })

      expect(result.status).toBe("invited")
      expect(result.projectId).toBe(existingProject.id)
    })
  })

  describe("previewInvitation", () => {
    it("should return would_invite for new user", async () => {
      const result = await service.previewInvitation({
        email: "new@example.com",
        organizationName: "New Org",
      })

      expect(result.status).toBe("would_invite")
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

      await projectMembershipRepository.save(
        projectMembershipRepository.create({
          projectId: project.id,
          userId: existingUser.id,
          role: "admin",
        }),
      )

      const result = await service.previewInvitation({
        email: "owner@example.com",
        organizationName: "Test Org",
      })

      expect(result.status).toBe("would_skip_existing_membership")
    })
  })
})

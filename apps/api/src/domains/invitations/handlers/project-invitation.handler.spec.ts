import { randomUUID } from "node:crypto"
import { NotFoundException, UnauthorizedException } from "@nestjs/common"
import type { AllRepositories } from "@/common/test/test-database"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { organizationMembershipFactory } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { projectMembershipFactory } from "@/domains/projects/memberships/project-membership.factory"
import { userFactory } from "@/domains/users/user.factory"
import { mockInvitationSender, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { InvitationsModule } from "../invitations.module"
import { ProjectInvitationHandler } from "./project-invitation.handler"

describe("ProjectInvitationHandler", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let handler: ProjectInvitationHandler
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => "auth0|project-invitation-handler-spec"),
    })
    handler = setup.module.get(ProjectInvitationHandler)
    repositories = setup.getAllRepositories()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockInvitationSender.resetTicketCounter()
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  // ─── inviteMembers ───────────────────────────────────────────────────────────

  describe("inviteMembers", () => {
    it("creates a pending invitation for a new email", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)

      const invitations = await handler.inviteMembers({
        projectId: project.id,
        emails: ["newmember@example.com"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(1)
      expect(invitations[0]!.invitedEmail).toBe("newmember@example.com")
      expect(invitations[0]!.status).toBe("pending")
      expect(invitations[0]!.userId).toBeNull()
      expect(invitations[0]!.targetType).toBe("project")
      expect(invitations[0]!.targetId).toBe(project.id)
      expect(mockInvitationSender.sendInvitation).toHaveBeenCalledTimes(1)
    })

    it("normalises email to lowercase before creating the invitation", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)

      const invitations = await handler.inviteMembers({
        projectId: project.id,
        emails: ["Mixed.Case@Example.COM"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(1)
      expect(invitations[0]!.invitedEmail).toBe("mixed.case@example.com")
    })

    it("links the invitation to an existing user when the email already exists", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)
      const existingUser = userFactory.build({ email: "existing@example.com" })
      await repositories.userRepository.save(existingUser)

      const invitations = await handler.inviteMembers({
        projectId: project.id,
        emails: ["existing@example.com"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(1)
      expect(invitations[0]!.userId).toBe(existingUser.id)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("skips an invitation when the user is already a project member", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)

      const invitations = await handler.inviteMembers({
        projectId: project.id,
        emails: [user.email],
        inviterName: "Inviter",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("promotes an existing non-admin project membership to admin when re-invited", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)
      const memberUser = userFactory.build({ email: "member@example.com" })
      await repositories.userRepository.save(memberUser)
      const membership = projectMembershipFactory
        .member()
        .transient({ project, user: memberUser })
        .build()
      await repositories.projectMembershipRepository.save(membership)

      await handler.inviteMembers({
        projectId: project.id,
        emails: [memberUser.email],
        inviterName: user.name ?? "Inviter",
      })

      const updatedMembership = await repositories.projectMembershipRepository.findOneOrFail({
        where: { id: membership.id },
      })
      expect(updatedMembership.role).toBe("admin")
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("does not change an already-admin membership when re-invited", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)
      const adminUser = userFactory.build({ email: "admin@example.com" })
      await repositories.userRepository.save(adminUser)
      const membership = projectMembershipFactory
        .admin()
        .transient({ project, user: adminUser })
        .build()
      await repositories.projectMembershipRepository.save(membership)

      await handler.inviteMembers({
        projectId: project.id,
        emails: [adminUser.email],
        inviterName: user.name ?? "Inviter",
      })

      const updatedMembership = await repositories.projectMembershipRepository.findOneOrFail({
        where: { id: membership.id },
      })
      expect(updatedMembership.role).toBe("admin")
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("skips an email when a pending invitation already exists for it", async () => {
      const { project, organization, user } = await createOrganizationWithProject(repositories)
      await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "project",
        targetId: project.id,
        userId: null,
        invitedEmail: "pending@example.com",
        role: "admin",
        invitationToken: "existing-token",
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      })

      const invitations = await handler.inviteMembers({
        projectId: project.id,
        emails: ["pending@example.com"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("skips blank email entries", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)

      const invitations = await handler.inviteMembers({
        projectId: project.id,
        emails: ["", "  "],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("processes multiple emails and returns all created invitations", async () => {
      const { project, user } = await createOrganizationWithProject(repositories)

      const invitations = await handler.inviteMembers({
        projectId: project.id,
        emails: ["alpha@example.com", "beta@example.com"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(2)
      expect(mockInvitationSender.sendInvitation).toHaveBeenCalledTimes(2)
    })
  })

  // ─── resolveScope ─────────────────────────────────────────────────────────

  describe("resolveScope", () => {
    it("returns the organizationId and projectId for a valid project", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)

      const scope = await handler.resolveScope(project.id)

      expect(scope).toEqual({ organizationId: organization.id, projectId: project.id })
    })

    it("throws NotFoundException for an unknown project", async () => {
      await expect(handler.resolveScope(randomUUID())).rejects.toThrow(NotFoundException)
    })
  })

  // ─── resolveTargetNameByInvitationId ──────────────────────────────────────

  describe("resolveTargetNameByInvitationId", () => {
    it("returns a map with an empty string for each invitation id", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      const invitation = await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "project",
        targetId: project.id,
        userId: null,
        invitedEmail: "user@example.com",
        role: "admin",
        invitationToken: "some-token",
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      })

      const nameMap = await handler.resolveTargetNameByInvitationId([invitation])

      expect(nameMap.get(invitation.id)).toBe("")
    })
  })

  // ─── canHandle ────────────────────────────────────────────────────────────

  describe("canHandle", () => {
    it("returns true when a project invitation exists for the ticketId", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "project",
        targetId: project.id,
        userId: null,
        invitedEmail: "user@example.com",
        role: "admin",
        invitationToken: "my-ticket",
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      })

      await expect(handler.canHandle("my-ticket")).resolves.toBe(true)
    })

    it("returns false when no invitation exists for the ticketId", async () => {
      await expect(handler.canHandle("unknown-ticket")).resolves.toBe(false)
    })
  })

  // ─── acceptInvitation ─────────────────────────────────────────────────────

  describe("acceptInvitation", () => {
    const createPendingInvitation = async ({
      projectId,
      organizationId,
      invitedEmail,
      userId = null,
      token = "accept-ticket",
    }: {
      projectId: string
      organizationId: string
      invitedEmail: string
      userId?: string | null
      token?: string
    }) => {
      return repositories.invitationRepository.save({
        organizationId,
        projectId,
        targetType: "project",
        targetId: projectId,
        userId,
        invitedEmail,
        role: "admin",
        invitationToken: token,
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      })
    }

    it("creates a new user, project membership, and org membership on first accept", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      const inviteeEmail = "invitee@example.com"
      await createPendingInvitation({
        projectId: project.id,
        organizationId: organization.id,
        invitedEmail: inviteeEmail,
      })

      const result = await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: "auth0|new-user",
        email: inviteeEmail,
      })

      expect(result.userId).toBeDefined()

      const createdUser = await repositories.userRepository.findOneOrFail({
        where: { auth0Id: "auth0|new-user" },
      })
      expect(createdUser.email).toBe(inviteeEmail)

      const projectMembership = await repositories.projectMembershipRepository.findOne({
        where: { projectId: project.id, userId: createdUser.id },
      })
      expect(projectMembership).not.toBeNull()
      expect(projectMembership!.role).toBe("admin")

      const orgMembership = await repositories.organizationMembershipRepository.findOne({
        where: { organizationId: organization.id, userId: createdUser.id },
      })
      expect(orgMembership).not.toBeNull()
      expect(orgMembership!.role).toBe("admin")
    })

    it("resolves an existing user found by auth0Id", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      const existingUser = userFactory.build({
        email: "byauth0@example.com",
        auth0Id: "auth0|existing-sub",
      })
      await repositories.userRepository.save(existingUser)
      await createPendingInvitation({
        projectId: project.id,
        organizationId: organization.id,
        invitedEmail: existingUser.email,
      })

      const result = await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: "auth0|existing-sub",
        email: existingUser.email,
      })

      expect(result.userId).toBe(existingUser.id)
    })

    it("resolves an existing user found by email and updates their auth0Id", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      const existingUser = userFactory.build({
        email: "byemail@example.com",
        auth0Id: "auth0|old-sub",
      })
      await repositories.userRepository.save(existingUser)
      await createPendingInvitation({
        projectId: project.id,
        organizationId: organization.id,
        invitedEmail: existingUser.email,
      })

      const result = await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: "auth0|new-sub",
        email: existingUser.email,
      })

      expect(result.userId).toBe(existingUser.id)
      const updated = await repositories.userRepository.findOneOrFail({
        where: { id: existingUser.id },
      })
      expect(updated.auth0Id).toBe("auth0|new-sub")
    })

    it("throws NotFoundException for an unknown ticketId", async () => {
      await expect(
        handler.acceptInvitation({
          ticketId: "no-such-ticket",
          auth0Sub: "auth0|user",
          email: "user@example.com",
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it("throws UnauthorizedException when the accepting email does not match the invited email", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      await createPendingInvitation({
        projectId: project.id,
        organizationId: organization.id,
        invitedEmail: "invited@example.com",
      })

      await expect(
        handler.acceptInvitation({
          ticketId: "accept-ticket",
          auth0Sub: "auth0|wrong-user",
          email: "wrong@example.com",
        }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it("upgrades an existing non-admin project membership to admin on accept", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      const inviteeUser = userFactory.build({ email: "member@example.com" })
      await repositories.userRepository.save(inviteeUser)
      const membership = projectMembershipFactory
        .member()
        .transient({ project, user: inviteeUser })
        .build()
      await repositories.projectMembershipRepository.save(membership)
      await createPendingInvitation({
        projectId: project.id,
        organizationId: organization.id,
        invitedEmail: inviteeUser.email,
        userId: inviteeUser.id,
      })

      await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: inviteeUser.auth0Id,
        email: inviteeUser.email,
      })

      const updatedMembership = await repositories.projectMembershipRepository.findOneOrFail({
        where: { id: membership.id },
      })
      expect(updatedMembership.role).toBe("admin")
    })

    it("upgrades an existing member-role org membership to admin on accept", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      const inviteeUser = userFactory.build({ email: "orgmember@example.com" })
      await repositories.userRepository.save(inviteeUser)
      const orgMembership = organizationMembershipFactory
        .member()
        .transient({ user: inviteeUser, organization })
        .build()
      await repositories.organizationMembershipRepository.save(orgMembership)
      await createPendingInvitation({
        projectId: project.id,
        organizationId: organization.id,
        invitedEmail: inviteeUser.email,
        userId: inviteeUser.id,
      })

      await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: inviteeUser.auth0Id,
        email: inviteeUser.email,
      })

      const updatedOrgMembership =
        await repositories.organizationMembershipRepository.findOneOrFail({
          where: { id: orgMembership.id },
        })
      expect(updatedOrgMembership.role).toBe("admin")
    })

    it("does not change an existing admin org membership role on accept", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      const inviteeUser = userFactory.build({ email: "orgadmin@example.com" })
      await repositories.userRepository.save(inviteeUser)
      const orgMembership = organizationMembershipFactory
        .admin()
        .transient({ user: inviteeUser, organization })
        .build()
      await repositories.organizationMembershipRepository.save(orgMembership)
      await createPendingInvitation({
        projectId: project.id,
        organizationId: organization.id,
        invitedEmail: inviteeUser.email,
        userId: inviteeUser.id,
      })

      await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: inviteeUser.auth0Id,
        email: inviteeUser.email,
      })

      const updatedOrgMembership =
        await repositories.organizationMembershipRepository.findOneOrFail({
          where: { id: orgMembership.id },
        })
      expect(updatedOrgMembership.role).toBe("admin")
    })

    it("is case-insensitive when comparing email to invitedEmail", async () => {
      const { project, organization } = await createOrganizationWithProject(repositories)
      await createPendingInvitation({
        projectId: project.id,
        organizationId: organization.id,
        invitedEmail: "Case@Example.com",
      })

      await expect(
        handler.acceptInvitation({
          ticketId: "accept-ticket",
          auth0Sub: "auth0|case-user",
          email: "case@example.com",
        }),
      ).resolves.toBeDefined()
    })
  })
})

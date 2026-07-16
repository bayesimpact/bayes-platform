import { randomUUID } from "node:crypto"
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common"
import type { AllRepositories } from "@/common/test/test-database"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  agentMembershipFactory,
  saveAgentMembership,
} from "@/domains/agents/memberships/agent-membership.factory"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  projectMembershipFactory,
  saveProjectMembership,
} from "@/domains/projects/memberships/project-membership.factory"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import { mockInvitationSender, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureOrganizationRbacCatalog } from "../../../../test/rbac-test.helpers"
import { InvitationsModule } from "../invitations.module"
import { AgentInvitationHandler } from "./agent-invitation.handler"

describe("AgentInvitationHandler", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let handler: AgentInvitationHandler
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule, RbacModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => "auth0|agent-invitation-handler-spec"),
    })
    await ensureOrganizationRbacCatalog(setup.module)
    handler = setup.module.get(AgentInvitationHandler)
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

  // ─── inviteMembers ────────────────────────────────────────────────────────

  describe("inviteMembers", () => {
    it("creates a pending member invitation for a new email", async () => {
      const { agent, user } = await createOrganizationWithAgent(repositories)

      const invitations = await handler.inviteMembers({
        agentId: agent.id,
        emails: ["newmember@example.com"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(1)
      expect(invitations[0]!.invitedEmail).toBe("newmember@example.com")
      expect(invitations[0]!.status).toBe("pending")
      expect(invitations[0]!.role).toBe("member")
      expect(invitations[0]!.userId).toBeNull()
      expect(invitations[0]!.targetType).toBe("agent")
      expect(invitations[0]!.targetId).toBe(agent.id)
      expect(mockInvitationSender.sendInvitation).toHaveBeenCalledTimes(1)
    })

    it("normalises email to lowercase", async () => {
      const { agent, user } = await createOrganizationWithAgent(repositories)

      const invitations = await handler.inviteMembers({
        agentId: agent.id,
        emails: ["Mixed.Case@Example.COM"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations[0]!.invitedEmail).toBe("mixed.case@example.com")
    })

    it("links the invitation to an existing user when the email already exists", async () => {
      const { agent, user } = await createOrganizationWithAgent(repositories)
      const existingUser = userFactory.build({ email: "existing@example.com" })
      await repositories.userRepository.save(existingUser)

      const invitations = await handler.inviteMembers({
        agentId: agent.id,
        emails: ["existing@example.com"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations[0]!.userId).toBe(existingUser.id)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("skips when the user is already an agent member", async () => {
      const { agent, user } = await createOrganizationWithAgent(repositories)

      const invitations = await handler.inviteMembers({
        agentId: agent.id,
        emails: [user.email],
        inviterName: "Inviter",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("skips when a pending invitation already exists for the email", async () => {
      const { agent, organization, project, user } = await createOrganizationWithAgent(repositories)
      await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "agent",
        targetId: agent.id,
        userId: null,
        invitedEmail: "pending@example.com",
        role: "member",
        invitationToken: "existing-token",
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      })

      const invitations = await handler.inviteMembers({
        agentId: agent.id,
        emails: ["pending@example.com"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("skips blank email entries", async () => {
      const { agent, user } = await createOrganizationWithAgent(repositories)

      const invitations = await handler.inviteMembers({
        agentId: agent.id,
        emails: ["", "  "],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("processes multiple emails and returns all created invitations", async () => {
      const { agent, user } = await createOrganizationWithAgent(repositories)

      const invitations = await handler.inviteMembers({
        agentId: agent.id,
        emails: ["alpha@example.com", "beta@example.com"],
        inviterName: user.name ?? "Inviter",
      })

      expect(invitations).toHaveLength(2)
      expect(mockInvitationSender.sendInvitation).toHaveBeenCalledTimes(2)
    })
  })

  // ─── resolveScope ─────────────────────────────────────────────────────────

  describe("resolveScope", () => {
    it("returns the organizationId and projectId for a valid agent", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)

      const scope = await handler.resolveScope(agent.id)

      expect(scope).toEqual({ organizationId: organization.id, projectId: project.id })
    })

    it("throws NotFoundException for an unknown agent", async () => {
      await expect(handler.resolveScope(randomUUID())).rejects.toThrow(NotFoundException)
    })
  })

  // ─── resolveTargetNameByInvitationId ──────────────────────────────────────

  describe("resolveTargetNameByInvitationId", () => {
    it("returns an empty map when given no invitations", async () => {
      const result = await handler.resolveTargetNameByInvitationId([])
      expect(result.size).toBe(0)
    })

    it("returns the agent name keyed by invitation id", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      const invitation = await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "agent",
        targetId: agent.id,
        userId: null,
        invitedEmail: "user@example.com",
        role: "member",
        invitationToken: "some-token",
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      })

      const nameMap = await handler.resolveTargetNameByInvitationId([invitation])

      expect(nameMap.get(invitation.id)).toBe(agent.name)
    })

    it("returns an empty string when the agent no longer exists", async () => {
      const { organization, project } = await createOrganizationWithAgent(repositories)
      const invitation = await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "agent",
        targetId: randomUUID(),
        userId: null,
        invitedEmail: "user@example.com",
        role: "member",
        invitationToken: "orphan-token",
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
    it("returns true when an agent invitation exists for the ticketId", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "agent",
        targetId: agent.id,
        userId: null,
        invitedEmail: "user@example.com",
        role: "member",
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
    const seedPendingInvitation = async ({
      agentId,
      organizationId,
      projectId,
      invitedEmail,
      userId = null,
      token = "accept-ticket",
    }: {
      agentId: string
      organizationId: string
      projectId: string
      invitedEmail: string
      userId?: string | null
      token?: string
    }) =>
      repositories.invitationRepository.save({
        organizationId,
        projectId,
        targetType: "agent",
        targetId: agentId,
        userId,
        invitedEmail,
        role: "member",
        invitationToken: token,
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      })

    it("creates a new user, agent membership, project membership, and org membership on first accept", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      const inviteeEmail = "invitee@example.com"
      await seedPendingInvitation({
        agentId: agent.id,
        organizationId: organization.id,
        projectId: project.id,
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

      const agentMembership = await repositories.userMembershipRepository.findOne({
        where: {
          resourceType: "agent",
          resourceId: agent.id,
          userId: createdUser.id,
        },
      })
      expect(agentMembership).not.toBeNull()
      expect(agentMembership!.role).toBe("member")

      const projectMembership = await repositories.userMembershipRepository.findOne({
        where: {
          resourceType: "project",
          resourceId: project.id,
          userId: createdUser.id,
        },
      })
      expect(projectMembership).not.toBeNull()
      expect(projectMembership!.role).toBe("member")

      const orgMembership = await repositories.userMembershipRepository.findOne({
        where: {
          resourceType: "organization",
          resourceId: organization.id,
          userId: createdUser.id,
        },
      })
      expect(orgMembership).not.toBeNull()
      expect(orgMembership!.role).toBe("member")
      const orgMemberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })
      expect(orgMembership!.roleId).toBe(orgMemberRole.id)
    })

    it("resolves an existing user found by auth0Id", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      const existingUser = userFactory.build({
        email: "byauth0@example.com",
        auth0Id: "auth0|existing-sub",
      })
      await repositories.userRepository.save(existingUser)
      await seedPendingInvitation({
        agentId: agent.id,
        organizationId: organization.id,
        projectId: project.id,
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
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      const existingUser = userFactory.build({
        email: "byemail@example.com",
        auth0Id: "auth0|old-sub",
      })
      await repositories.userRepository.save(existingUser)
      await seedPendingInvitation({
        agentId: agent.id,
        organizationId: organization.id,
        projectId: project.id,
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

    it("throws BadRequestException when the invitation has been revoked", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "agent",
        targetId: agent.id,
        userId: null,
        invitedEmail: "user@example.com",
        role: "member",
        invitationToken: "revoked-ticket",
        status: "revoked",
        invitedAt: new Date(),
        acceptedAt: null,
      })

      await expect(
        handler.acceptInvitation({
          ticketId: "revoked-ticket",
          auth0Sub: "auth0|user",
          email: "user@example.com",
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it("throws BadRequestException when the invitation has already been accepted", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "agent",
        targetId: agent.id,
        userId: null,
        invitedEmail: "user@example.com",
        role: "member",
        invitationToken: "already-accepted-ticket",
        status: "accepted",
        invitedAt: new Date(),
        acceptedAt: new Date(),
      })

      await expect(
        handler.acceptInvitation({
          ticketId: "already-accepted-ticket",
          auth0Sub: "auth0|user",
          email: "user@example.com",
        }),
      ).rejects.toThrow(BadRequestException)
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
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      await seedPendingInvitation({
        agentId: agent.id,
        organizationId: organization.id,
        projectId: project.id,
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

    it("does not create a duplicate agent membership when one already exists", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      const inviteeUser = userFactory.build({ email: "already-member@example.com" })
      await repositories.userRepository.save(inviteeUser)
      const membership = agentMembershipFactory
        .member()
        .transient({ agent, user: inviteeUser })
        .build()
      await saveAgentMembership({ repositories, membership })
      await seedPendingInvitation({
        agentId: agent.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: inviteeUser.email,
        userId: inviteeUser.id,
      })

      await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: inviteeUser.auth0Id,
        email: inviteeUser.email,
      })

      const memberships = await repositories.userMembershipRepository.find({
        where: {
          resourceType: "agent",
          resourceId: agent.id,
          userId: inviteeUser.id,
        },
      })
      expect(memberships).toHaveLength(1)
    })

    it("does not create a duplicate project membership when one already exists", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      const inviteeUser = userFactory.build({ email: "proj-member@example.com" })
      await repositories.userRepository.save(inviteeUser)
      await saveProjectMembership({
        repositories,
        membership: projectMembershipFactory
          .member()
          .transient({ project, user: inviteeUser })
          .build(),
      })
      await seedPendingInvitation({
        agentId: agent.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: inviteeUser.email,
        userId: inviteeUser.id,
      })

      await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: inviteeUser.auth0Id,
        email: inviteeUser.email,
      })

      const projectMemberships = await repositories.userMembershipRepository.find({
        where: {
          resourceType: "project",
          resourceId: project.id,
          userId: inviteeUser.id,
        },
      })
      expect(projectMemberships).toHaveLength(1)
    })

    it("does not create a duplicate org membership when one already exists", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      const inviteeUser = userFactory.build({ email: "org-member@example.com" })
      await repositories.userRepository.save(inviteeUser)
      await saveOrgMembership({
        repositories,
        membership: organizationMembershipFactory
          .member()
          .transient({ user: inviteeUser, organization })
          .build(),
      })
      await seedPendingInvitation({
        agentId: agent.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: inviteeUser.email,
        userId: inviteeUser.id,
      })

      await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: inviteeUser.auth0Id,
        email: inviteeUser.email,
      })

      const orgMemberships = await repositories.userMembershipRepository.find({
        where: {
          resourceType: "organization",
          resourceId: organization.id,
          userId: inviteeUser.id,
        },
      })
      expect(orgMemberships).toHaveLength(1)
    })

    it("is case-insensitive when comparing email to invitedEmail", async () => {
      const { agent, organization, project } = await createOrganizationWithAgent(repositories)
      await seedPendingInvitation({
        agentId: agent.id,
        organizationId: organization.id,
        projectId: project.id,
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

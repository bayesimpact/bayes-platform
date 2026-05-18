import { randomUUID } from "node:crypto"
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import type { AllRepositories } from "@/common/test/test-database"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { reviewCampaignMembershipFactory } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import { mockInvitationSender, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { InvitationsModule } from "../invitations.module"
import { ReviewCampaignInvitationHandler } from "./review-campaign-invitation.handler"

describe("ReviewCampaignInvitationHandler", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let handler: ReviewCampaignInvitationHandler
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(
          moduleBuilder,
          () => "auth0|review-campaign-invitation-handler-spec",
        ),
    })
    handler = setup.module.get(ReviewCampaignInvitationHandler)
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

  // ─── helpers ──────────────────────────────────────────────────────────────

  const createActiveCampaign = async () => {
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const agent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.active().transient({ organization, project, agent }).build(),
    )
    return { organization, project, agent, campaign, user }
  }

  const createDraftCampaign = async () => {
    const { organization, project, user } = await createOrganizationWithProject(repositories)
    const agent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.draft().transient({ organization, project, agent }).build(),
    )
    return { organization, project, agent, campaign, user }
  }

  const seedPendingInvitation = async ({
    campaignId,
    organizationId,
    projectId,
    invitedEmail,
    role = "tester" as const,
    userId = null,
    token = "accept-ticket",
  }: {
    campaignId: string
    organizationId: string
    projectId: string
    invitedEmail: string
    role?: "tester" | "reviewer"
    userId?: string | null
    token?: string
  }) =>
    repositories.invitationRepository.save({
      organizationId,
      projectId,
      targetType: "review_campaign",
      targetId: campaignId,
      userId,
      invitedEmail,
      role,
      invitationToken: token,
      status: "pending",
      invitedAt: new Date(),
      acceptedAt: null,
    })

  // ─── createInvitations ────────────────────────────────────────────────────

  describe("createInvitations", () => {
    it("throws BadRequestException when role is missing", async () => {
      const { campaign } = await createActiveCampaign()

      await expect(
        handler.createInvitations({
          targetId: campaign.id,
          emails: ["user@example.com"],
          inviterName: "Inviter",
          role: undefined,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it("throws BadRequestException for an invalid role value", async () => {
      const { campaign } = await createActiveCampaign()

      await expect(
        handler.createInvitations({
          targetId: campaign.id,
          emails: ["user@example.com"],
          inviterName: "Inviter",
          role: "admin",
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it("delegates to inviteMembers for a valid tester role", async () => {
      const { campaign } = await createActiveCampaign()

      const invitations = await handler.createInvitations({
        targetId: campaign.id,
        emails: ["user@example.com"],
        inviterName: "Inviter",
        role: "tester",
      })

      expect(invitations).toHaveLength(1)
      expect(invitations[0]!.role).toBe("tester")
    })

    it("delegates to inviteMembers for a valid reviewer role", async () => {
      const { campaign } = await createActiveCampaign()

      const invitations = await handler.createInvitations({
        targetId: campaign.id,
        emails: ["reviewer@example.com"],
        inviterName: "Inviter",
        role: "reviewer",
      })

      expect(invitations).toHaveLength(1)
      expect(invitations[0]!.role).toBe("reviewer")
    })
  })

  // ─── inviteMembers ────────────────────────────────────────────────────────

  describe("inviteMembers", () => {
    it("creates a pending invitation with the given role for a new email", async () => {
      const { campaign, user } = await createActiveCampaign()

      const invitations = await handler.inviteMembers({
        reviewCampaignId: campaign.id,
        emails: ["newmember@example.com"],
        inviterName: user.name ?? "Inviter",
        role: "tester",
      })

      expect(invitations).toHaveLength(1)
      expect(invitations[0]!.invitedEmail).toBe("newmember@example.com")
      expect(invitations[0]!.status).toBe("pending")
      expect(invitations[0]!.role).toBe("tester")
      expect(invitations[0]!.userId).toBeNull()
      expect(invitations[0]!.targetType).toBe("review_campaign")
      expect(invitations[0]!.targetId).toBe(campaign.id)
      expect(mockInvitationSender.sendInvitation).toHaveBeenCalledTimes(1)
    })

    it("normalises email to lowercase", async () => {
      const { campaign, user } = await createActiveCampaign()

      const invitations = await handler.inviteMembers({
        reviewCampaignId: campaign.id,
        emails: ["Mixed.Case@Example.COM"],
        inviterName: user.name ?? "Inviter",
        role: "tester",
      })

      expect(invitations[0]!.invitedEmail).toBe("mixed.case@example.com")
    })

    it("links the invitation to an existing user when the email already exists", async () => {
      const { campaign, user } = await createActiveCampaign()
      const existingUser = userFactory.build({ email: "existing@example.com" })
      await repositories.userRepository.save(existingUser)

      const invitations = await handler.inviteMembers({
        reviewCampaignId: campaign.id,
        emails: ["existing@example.com"],
        inviterName: user.name ?? "Inviter",
        role: "tester",
      })

      expect(invitations[0]!.userId).toBe(existingUser.id)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("skips when the user already has a membership with the same role in the campaign", async () => {
      const { campaign, organization, project, user } = await createActiveCampaign()
      const memberUser = userFactory.build({ email: "member@example.com" })
      await repositories.userRepository.save(memberUser)
      await repositories.reviewCampaignMembershipRepository.save(
        reviewCampaignMembershipFactory
          .tester()
          .transient({ organization, project, campaign, user: memberUser })
          .build(),
      )

      const invitations = await handler.inviteMembers({
        reviewCampaignId: campaign.id,
        emails: [memberUser.email],
        inviterName: user.name ?? "Inviter",
        role: "tester",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("allows inviting a tester as reviewer (different role, not skipped)", async () => {
      const { campaign, organization, project, user } = await createActiveCampaign()
      const memberUser = userFactory.build({ email: "tester@example.com" })
      await repositories.userRepository.save(memberUser)
      await repositories.reviewCampaignMembershipRepository.save(
        reviewCampaignMembershipFactory
          .tester()
          .transient({ organization, project, campaign, user: memberUser })
          .build(),
      )

      const invitations = await handler.inviteMembers({
        reviewCampaignId: campaign.id,
        emails: [memberUser.email],
        inviterName: user.name ?? "Inviter",
        role: "reviewer",
      })

      expect(invitations).toHaveLength(1)
    })

    it("skips when a pending invitation already exists for the email", async () => {
      const { campaign, organization, project, user } = await createActiveCampaign()
      await seedPendingInvitation({
        campaignId: campaign.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: "pending@example.com",
        role: "tester",
        token: "existing-token",
      })

      const invitations = await handler.inviteMembers({
        reviewCampaignId: campaign.id,
        emails: ["pending@example.com"],
        inviterName: user.name ?? "Inviter",
        role: "tester",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("skips blank email entries", async () => {
      const { campaign, user } = await createActiveCampaign()

      const invitations = await handler.inviteMembers({
        reviewCampaignId: campaign.id,
        emails: ["", "  "],
        inviterName: user.name ?? "Inviter",
        role: "tester",
      })

      expect(invitations).toHaveLength(0)
      expect(mockInvitationSender.sendInvitation).not.toHaveBeenCalled()
    })

    it("throws ConflictException when the campaign is not active", async () => {
      const { campaign, user } = await createDraftCampaign()

      await expect(
        handler.inviteMembers({
          reviewCampaignId: campaign.id,
          emails: ["user@example.com"],
          inviterName: user.name ?? "Inviter",
          role: "tester",
        }),
      ).rejects.toThrow(ConflictException)
    })

    it("processes multiple emails and returns all created invitations", async () => {
      const { campaign, user } = await createActiveCampaign()

      const invitations = await handler.inviteMembers({
        reviewCampaignId: campaign.id,
        emails: ["alpha@example.com", "beta@example.com"],
        inviterName: user.name ?? "Inviter",
        role: "tester",
      })

      expect(invitations).toHaveLength(2)
      expect(mockInvitationSender.sendInvitation).toHaveBeenCalledTimes(2)
    })
  })

  // ─── resolveScope ─────────────────────────────────────────────────────────

  describe("resolveScope", () => {
    it("returns the organizationId and projectId for a valid campaign", async () => {
      const { campaign, organization, project } = await createActiveCampaign()

      const scope = await handler.resolveScope(campaign.id)

      expect(scope).toEqual({ organizationId: organization.id, projectId: project.id })
    })

    it("throws NotFoundException for an unknown campaign", async () => {
      await expect(handler.resolveScope(randomUUID())).rejects.toThrow(NotFoundException)
    })
  })

  // ─── resolveTargetNameByInvitationId ──────────────────────────────────────

  describe("resolveTargetNameByInvitationId", () => {
    it("returns an empty map when given no invitations", async () => {
      const result = await handler.resolveTargetNameByInvitationId([])
      expect(result.size).toBe(0)
    })

    it("returns the campaign name keyed by invitation id", async () => {
      const { campaign, organization, project } = await createActiveCampaign()
      const invitation = await seedPendingInvitation({
        campaignId: campaign.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: "user@example.com",
        token: "name-token",
      })

      const nameMap = await handler.resolveTargetNameByInvitationId([invitation])

      expect(nameMap.get(invitation.id)).toBe(campaign.name)
    })

    it("returns an empty string when the campaign no longer exists", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const invitation = await repositories.invitationRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        targetType: "review_campaign",
        targetId: randomUUID(),
        userId: null,
        invitedEmail: "user@example.com",
        role: "tester",
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
    it("returns true when a review_campaign invitation exists for the ticketId", async () => {
      const { campaign, organization, project } = await createActiveCampaign()
      await seedPendingInvitation({
        campaignId: campaign.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: "user@example.com",
        token: "my-ticket",
      })

      await expect(handler.canHandle("my-ticket")).resolves.toBe(true)
    })

    it("returns false when no invitation exists for the ticketId", async () => {
      await expect(handler.canHandle("unknown-ticket")).resolves.toBe(false)
    })
  })

  // ─── acceptInvitation ─────────────────────────────────────────────────────

  describe("acceptInvitation", () => {
    it("creates a new user, campaign membership (with acceptedAt), project membership, and org membership", async () => {
      const { campaign, organization, project } = await createActiveCampaign()
      const inviteeEmail = "invitee@example.com"
      await seedPendingInvitation({
        campaignId: campaign.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: inviteeEmail,
        role: "tester",
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

      const campaignMembership = await repositories.reviewCampaignMembershipRepository.findOne({
        where: { campaignId: campaign.id, userId: createdUser.id, role: "tester" },
      })
      expect(campaignMembership).not.toBeNull()
      expect(campaignMembership!.acceptedAt).not.toBeNull()

      const projectMembership = await repositories.projectMembershipRepository.findOne({
        where: { projectId: project.id, userId: createdUser.id },
      })
      expect(projectMembership).not.toBeNull()
      expect(projectMembership!.role).toBe("member")

      const orgMembership = await repositories.organizationMembershipRepository.findOne({
        where: { organizationId: organization.id, userId: createdUser.id },
      })
      expect(orgMembership).not.toBeNull()
      expect(orgMembership!.role).toBe("member")
    })

    it("resolves an existing user found by auth0Id", async () => {
      const { campaign, organization, project } = await createActiveCampaign()
      const existingUser = userFactory.build({
        email: "byauth0@example.com",
        auth0Id: "auth0|existing-sub",
      })
      await repositories.userRepository.save(existingUser)
      await seedPendingInvitation({
        campaignId: campaign.id,
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
      const { campaign, organization, project } = await createActiveCampaign()
      await seedPendingInvitation({
        campaignId: campaign.id,
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

    it("stamps acceptedAt when an existing membership has not yet been accepted", async () => {
      const { campaign, organization, project } = await createActiveCampaign()
      const inviteeUser = userFactory.build({ email: "unaccepted@example.com" })
      await repositories.userRepository.save(inviteeUser)
      const membership = await repositories.reviewCampaignMembershipRepository.save(
        reviewCampaignMembershipFactory
          .tester()
          .transient({ organization, project, campaign, user: inviteeUser })
          .build({ acceptedAt: null }),
      )
      await seedPendingInvitation({
        campaignId: campaign.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: inviteeUser.email,
        role: "tester",
        userId: inviteeUser.id,
      })

      await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: inviteeUser.auth0Id,
        email: inviteeUser.email,
      })

      const updated = await repositories.reviewCampaignMembershipRepository.findOneOrFail({
        where: { id: membership.id },
      })
      expect(updated.acceptedAt).not.toBeNull()
    })

    it("does not re-stamp acceptedAt when the membership is already accepted", async () => {
      const { campaign, organization, project } = await createActiveCampaign()
      const inviteeUser = userFactory.build({ email: "accepted@example.com" })
      await repositories.userRepository.save(inviteeUser)
      const originalAcceptedAt = new Date("2025-01-01T00:00:00.000Z")
      const membership = await repositories.reviewCampaignMembershipRepository.save(
        reviewCampaignMembershipFactory
          .tester()
          .accepted()
          .transient({ organization, project, campaign, user: inviteeUser })
          .build({ acceptedAt: originalAcceptedAt }),
      )
      await seedPendingInvitation({
        campaignId: campaign.id,
        organizationId: organization.id,
        projectId: project.id,
        invitedEmail: inviteeUser.email,
        role: "tester",
        userId: inviteeUser.id,
      })

      await handler.acceptInvitation({
        ticketId: "accept-ticket",
        auth0Sub: inviteeUser.auth0Id,
        email: inviteeUser.email,
      })

      const updated = await repositories.reviewCampaignMembershipRepository.findOneOrFail({
        where: { id: membership.id },
      })
      expect(updated.acceptedAt!.getTime()).toBe(originalAcceptedAt.getTime())
    })

    it("is case-insensitive when comparing email to invitedEmail", async () => {
      const { campaign, organization, project } = await createActiveCampaign()
      await seedPendingInvitation({
        campaignId: campaign.id,
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

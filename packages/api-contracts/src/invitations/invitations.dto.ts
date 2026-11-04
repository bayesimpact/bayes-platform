import { z } from "zod"
import type { TimeType } from "../generic"

export type InvitationTargetTypeDto = "project" | "agent" | "review_campaign"

export type InvitationStatusDto = "pending" | "accepted" | "declined" | "revoked" | "expired"

/**
 * Access to a project, an agent or a review campaign offered to someone by
 * email. The platform sends no email: the invited person finds the
 * invitation in the app after signing in, and accepts or declines it.
 */
export type InvitationDto = {
  id: string
  organizationId: string
  projectId: string
  targetType: InvitationTargetTypeDto
  targetId: string
  invitedEmail: string
  role: string
  status: InvitationStatusDto
  invitedAt: TimeType
  acceptedAt: TimeType | null
  organizationName: string
  projectName: string
  targetName: string
  /**
   * The agents a workspace invitation also gives, each with its member role. Empty for other
   * invitations, and for a workspace admin, who is admin of every agent. A deleted agent is left
   * out.
   */
  agents: InvitationAgentDto[]
}

export type InvitationAgentDto = {
  id: string
  name: string
}

/** The languages an invitation email can be written in. */
export const INVITATION_EMAIL_LANGUAGES = ["en", "fr"] as const
export type InvitationEmailLanguageDto = (typeof INVITATION_EMAIL_LANGUAGES)[number]

export type CreateInvitationsRequestDto = {
  emails: string[]
  /** The inviter's language: the email is written in it. English when left out. */
  language?: InvitationEmailLanguageDto
}

/** The role a workspace invitation gives: owner is set when the workspace is created. */
export type WorkspaceInvitationRoleDto = "admin" | "member"

/** How many agents one workspace invitation can give. */
export const MAX_AGENTS_PER_INVITATION = 100

/**
 * Invites people to a workspace and, for members, to some of its agents in the same invitation.
 * Without a role, the invitation makes admins, as before.
 */
export const createProjectInvitationsSchema = z.object({
  emails: z.array(z.string()).min(1).max(200),
  role: z.enum(["admin", "member"]).optional(),
  agentIds: z
    .array(z.string().uuid())
    .max(MAX_AGENTS_PER_INVITATION)
    .refine((agentIds) => new Set(agentIds).size === agentIds.length, "Agent ids must be unique")
    .optional(),
  language: z.enum(INVITATION_EMAIL_LANGUAGES).optional(),
})
export type CreateProjectInvitationsRequestDto = z.infer<typeof createProjectInvitationsSchema>

export type ReviewCampaignInvitationRoleDto = "tester" | "reviewer"

export type CreateReviewCampaignInvitationsRequestDto = CreateInvitationsRequestDto & {
  role: ReviewCampaignInvitationRoleDto
}

export type CreateInvitationsResponseDto = {
  /** New pending invitations. Emails that already have access or a pending invitation are left out. */
  invitations: InvitationDto[]
  /** True when the platform emailed every new invitation (SMTP configured and every send succeeded). */
  emailSent: boolean
  /**
   * People already in the workspace who got the agents they missed right away, with no
   * invitation. Empty outside workspace invitations.
   */
  grantedEmails: string[]
}

/** What a person in the workspace holds, so the invite dialog can tell what an invitation changes. */
export type InviteeAccessDto = {
  email: string
  /** `project_owner`, `project_admin` or `project_member`: the highest role held. */
  workspaceRoleKey: string
  /** The agents of the workspace the person holds a member role on. */
  agentIds: string[]
}

export type ListInviteeAccessResponseDto = {
  members: InviteeAccessDto[]
}

export type ListInvitationsResponseDto = {
  invitations: InvitationDto[]
}

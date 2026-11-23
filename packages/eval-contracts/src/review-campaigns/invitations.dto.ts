import { z } from "zod"
import { reviewCampaignParamsSchema, reviewCampaignRoleSchema } from "./review-campaigns.dto"

/** The languages an invitation email is written in. */
export const invitationEmailLanguageSchema = z.enum(["en", "fr"])

export type InvitationEmailLanguageDto = z.output<typeof invitationEmailLanguageSchema>

/** How many people one invitation form invites at most. */
export const CAMPAIGN_INVITATION_EMAILS_MAX = 200

/** The people to invite to a campaign, all with the same role. */
export const createCampaignInvitationsInputSchema = z.strictObject({
  emails: z.array(z.email()).min(1).max(CAMPAIGN_INVITATION_EMAILS_MAX),
  role: reviewCampaignRoleSchema,
  language: invitationEmailLanguageSchema,
})

export type CreateCampaignInvitationsInputDto = z.input<typeof createCampaignInvitationsInputSchema>

/** An invitation to a campaign that the person did not answer yet. */
export const campaignInvitationOutputSchema = z.object({
  id: z.uuid(),
  invitedEmail: z.string(),
  /** `tester` or `reviewer`, as the API names it. */
  role: z.string(),
  status: z.enum(["pending", "accepted", "declined", "revoked", "expired"]),
  invitedAt: z.number(),
})

export type CampaignInvitationOutputDto = z.output<typeof campaignInvitationOutputSchema>

export const campaignInvitationsOutputSchema = z.object({
  invitations: z.array(campaignInvitationOutputSchema),
})

export const createCampaignInvitationsOutputSchema = z.object({
  /** The new invitations: the people who already had access or an invitation are left out. */
  invitations: z.array(campaignInvitationOutputSchema),
  /** Whether the platform emailed every new invitation. */
  emailSent: z.boolean(),
})

export const campaignInvitationParamsSchema = reviewCampaignParamsSchema.extend({
  invitationId: z.uuid(),
})

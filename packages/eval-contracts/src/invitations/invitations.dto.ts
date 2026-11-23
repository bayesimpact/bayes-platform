import { z } from "zod"

/** The params of the routes under one of the signed-in person's invitations. */
export const invitationParamsSchema = z.strictObject({
  invitationId: z.uuid(),
})

/** What an invitation gives access to. */
export const invitationTargetTypeSchema = z.enum(["project", "agent", "review_campaign"])

export type InvitationTargetTypeDto = z.output<typeof invitationTargetTypeSchema>

/** An invitation the signed-in person received, to a project, an agent or a review campaign. */
export const invitationOutputSchema = z.object({
  id: z.uuid(),
  organizationName: z.string(),
  projectName: z.string(),
  targetType: invitationTargetTypeSchema,
  targetName: z.string(),
  /** The role the invitation grants, as the API names it: `member`, `admin`, `tester`... */
  role: z.string(),
  status: z.enum(["pending", "accepted", "declined", "revoked", "expired"]),
  invitedAt: z.number(),
})

export type InvitationOutputDto = z.output<typeof invitationOutputSchema>

export const myInvitationsOutputSchema = z.object({
  invitations: z.array(invitationOutputSchema),
})

/** The answer of an accepted or declined invitation. */
export const invitationAnswerOutputSchema = z.object({ success: z.boolean() })

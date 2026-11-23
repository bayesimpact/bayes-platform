import { z } from "zod"
import { agentTypeSchema } from "../agents/agents.dto"
import { projectParamsSchema } from "../common/params.dto"

/** Where a review campaign stands: being prepared, open to its testers and reviewers, or over. */
export const reviewCampaignStatusSchema = z.enum(["draft", "active", "closed"])

export type ReviewCampaignStatusDto = z.output<typeof reviewCampaignStatusSchema>

/** The part a person takes in a campaign: they test its agent, or review the testers' sessions. */
export const reviewCampaignRoleSchema = z.enum(["tester", "reviewer"])

export type ReviewCampaignRoleDto = z.output<typeof reviewCampaignRoleSchema>

/** The role keys of the campaign roles, as the API names them on a membership. */
export const REVIEW_CAMPAIGN_ROLE_KEYS = {
  review_campaign_tester: "tester",
  review_campaign_reviewer: "reviewer",
} as const satisfies Record<string, ReviewCampaignRoleDto>

/** Sees the review campaigns of a project: the project's owners and admins hold it. */
export const PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION = "project.review_campaign.read" as const
export const PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION = "project.review_campaign.create" as const
export const PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION = "project.review_campaign.update" as const
export const PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION = "project.review_campaign.delete" as const
/** Invites testers and reviewers, sees the pending invitations and revokes them. */
export const PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION =
  "project.review_campaign.member.invite" as const
/** Removes a tester or a reviewer from a campaign. */
export const PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION =
  "project.review_campaign.member.delete" as const

export const reviewCampaignQuestionTypeSchema = z.enum(["rating", "single-choice", "free-text"])

export type ReviewCampaignQuestionTypeDto = z.output<typeof reviewCampaignQuestionTypeSchema>

/** The highest rating a tester or a reviewer gives: ratings go from 1 to this. */
export const RATING_MAX = 5

/**
 * A question of a campaign, asked to testers after a session, to testers at the end, or to
 * reviewers. `isFactual` matters on the testers' per-session questions only: the answer to a
 * factual rating or single-choice question stays visible to reviewers before they submit.
 */
export const reviewCampaignQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  type: reviewCampaignQuestionTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  isFactual: z.boolean().optional(),
})

export type ReviewCampaignQuestionDto = z.output<typeof reviewCampaignQuestionSchema>

/** A question as the editor sends it: a prompt, and two options at least for a single choice. */
export const reviewCampaignQuestionInputSchema = z
  .strictObject({
    id: z.string().min(1),
    prompt: z.string().trim().min(1),
    type: reviewCampaignQuestionTypeSchema,
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).optional(),
    isFactual: z.boolean().optional(),
  })
  .refine((question) => question.type !== "single-choice" || (question.options?.length ?? 0) >= 2, {
    path: ["options"],
  })

export type ReviewCampaignQuestionInputDto = z.input<typeof reviewCampaignQuestionInputSchema>

/** An answer to a question: a rating, a choice or a text. */
export const reviewCampaignAnswerSchema = z.object({
  questionId: z.string(),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
})

export type ReviewCampaignAnswerDto = z.output<typeof reviewCampaignAnswerSchema>

export const reviewCampaignAnswerInputSchema = z.strictObject({
  questionId: z.string().min(1),
  value: z.union([z.string(), z.number()]),
})

/** The params of the routes under one review campaign. */
export const reviewCampaignParamsSchema = projectParamsSchema.extend({
  reviewCampaignId: z.uuid(),
})

export type ReviewCampaignParamsDto = z.output<typeof reviewCampaignParamsSchema>

/** A review campaign, as its routes return it. */
export const reviewCampaignOutputSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  projectId: z.uuid(),
  agentId: z.uuid(),
  /** The saved version of the agent's settings the whole campaign runs on. */
  agentSettingsId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: reviewCampaignStatusSchema,
  testerPerSessionQuestions: z.array(reviewCampaignQuestionSchema),
  testerEndOfPhaseQuestions: z.array(reviewCampaignQuestionSchema),
  reviewerQuestions: z.array(reviewCampaignQuestionSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type ReviewCampaignOutputDto = z.output<typeof reviewCampaignOutputSchema>

/** A campaign of the list, with how many people take part in it. */
export const reviewCampaignListItemOutputSchema = reviewCampaignOutputSchema.extend({
  memberCount: z.number(),
})

export type ReviewCampaignListItemOutputDto = z.output<typeof reviewCampaignListItemOutputSchema>

export const reviewCampaignsOutputSchema = z.object({
  reviewCampaigns: z.array(reviewCampaignListItemOutputSchema),
})

/** A person of a campaign. Each role is a membership of its own, revoked on its own. */
export const reviewCampaignMembershipOutputSchema = z.object({
  userId: z.uuid(),
  userEmail: z.string(),
  /** False while the person was added by email and never signed in. */
  userHasSignedIn: z.boolean(),
  roles: z.array(z.object({ membershipId: z.uuid(), key: z.string() })),
})

export type ReviewCampaignMembershipOutputDto = z.output<
  typeof reviewCampaignMembershipOutputSchema
>

/** A campaign with its people and, once closed, its first figures. */
export const reviewCampaignDetailOutputSchema = reviewCampaignOutputSchema.extend({
  memberships: z.array(reviewCampaignMembershipOutputSchema),
  aggregates: z
    .object({
      meanTesterRating: z.number().nullable(),
      surveyCount: z.number(),
      sessionCount: z.number(),
    })
    .nullable(),
})

export type ReviewCampaignDetailOutputDto = z.output<typeof reviewCampaignDetailOutputSchema>

/** What a campaign is made of, as its editor sends it. */
const reviewCampaignConfigShape = {
  /** A saved version of the agent, never its draft. The API takes the one in production without it. */
  agentSettingsId: z.uuid(),
  name: z.string().trim().min(1),
  description: z.string().trim().nullable(),
  testerPerSessionQuestions: z.array(reviewCampaignQuestionInputSchema),
  testerEndOfPhaseQuestions: z.array(reviewCampaignQuestionInputSchema),
  reviewerQuestions: z.array(reviewCampaignQuestionInputSchema),
}

export const createReviewCampaignInputSchema = z.strictObject({
  agentId: z.uuid(),
  ...reviewCampaignConfigShape,
  agentSettingsId: reviewCampaignConfigShape.agentSettingsId.optional(),
})

export type CreateReviewCampaignInputDto = z.input<typeof createReviewCampaignInputSchema>

/** A draft's new configuration, or a campaign's next status alone. */
export const updateReviewCampaignInputSchema = z
  .strictObject({
    ...reviewCampaignConfigShape,
    status: reviewCampaignStatusSchema,
  })
  .partial()

export type UpdateReviewCampaignInputDto = z.input<typeof updateReviewCampaignInputSchema>

export const successOutputSchema = z.object({ success: z.boolean() })

/** The params of the route that revokes one role of one person. */
export const reviewCampaignMembershipParamsSchema = reviewCampaignParamsSchema.extend({
  membershipId: z.uuid(),
})

/** The query of `GET me/review-campaigns`: the campaigns where the person holds this role. */
export const myReviewCampaignsQuerySchema = z.strictObject({ role: reviewCampaignRoleSchema })

/** A campaign the person takes part in, open or closed: a draft is not theirs to see yet. */
export const myReviewCampaignOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: reviewCampaignStatusSchema,
  organizationId: z.uuid(),
  projectId: z.uuid(),
  agentId: z.uuid(),
  createdAt: z.number(),
  /**
   * The agent the campaign reviews, which the person may hold through no project: the agent
   * switcher lists it. `null` when the agent was deleted.
   */
  agent: z.object({ name: z.string(), type: agentTypeSchema }).nullable(),
})

export type MyReviewCampaignOutputDto = z.output<typeof myReviewCampaignOutputSchema>

export const myReviewCampaignsOutputSchema = z.object({
  reviewCampaigns: z.array(myReviewCampaignOutputSchema),
})

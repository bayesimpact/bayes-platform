import { z } from "zod"
import { agentTypeSchema } from "../agents/agents.dto"
import {
  RATING_MAX,
  reviewCampaignAnswerInputSchema,
  reviewCampaignAnswerSchema,
  reviewCampaignParamsSchema,
  reviewCampaignQuestionSchema,
} from "./review-campaigns.dto"

/** A tester's session, as the reviewers' list shows it. */
export const reviewerSessionListItemOutputSchema = z.object({
  sessionId: z.uuid(),
  startedAt: z.number(),
  /** The messages of the person and of the agent. */
  messageCount: z.number(),
  /** The reviews the session got, the caller's included. */
  reviewerCount: z.number(),
  callerHasReviewed: z.boolean(),
  /** A reviewer who also tests cannot review their own session. */
  callerIsSessionOwner: z.boolean(),
})

export type ReviewerSessionListItemOutputDto = z.output<typeof reviewerSessionListItemOutputSchema>

export const reviewerSessionsOutputSchema = z.object({
  sessions: z.array(reviewerSessionListItemOutputSchema),
})

/** The params of the routes under one session of a campaign. */
export const campaignSessionParamsSchema = reviewCampaignParamsSchema.extend({
  sessionId: z.uuid(),
})

export type CampaignSessionParamsDto = z.output<typeof campaignSessionParamsSchema>

/** A reviewer's review of a session. */
export const reviewerReviewOutputSchema = z.object({
  id: z.uuid(),
  reviewerUserId: z.uuid(),
  overallRating: z.number(),
  comment: z.string().nullable(),
  answers: z.array(reviewCampaignAnswerSchema),
})

export type ReviewerReviewOutputDto = z.output<typeof reviewerReviewOutputSchema>

/** What every reviewer sees of a session, before and after their own review. */
const reviewerSessionCommonShape = {
  sessionId: z.uuid(),
  testerUserId: z.uuid(),
  startedAt: z.number(),
  agent: z.object({ id: z.uuid(), name: z.string(), type: agentTypeSchema }),
  /** The messages of the person and of the agent, oldest first. */
  transcript: z.array(
    z.object({ id: z.uuid(), role: z.string(), content: z.string(), createdAt: z.number() }),
  ),
  reviewerQuestions: z.array(reviewCampaignQuestionSchema),
  otherReviewerCount: z.number(),
  /** The form the agent filled during the session, for an agent that fills one. */
  formResult: z
    .object({
      schema: z.record(z.string(), z.unknown()),
      /** `null` when the tester left before the agent produced a final value. */
      value: z.record(z.string(), z.unknown()).nullable(),
    })
    .nullable(),
}

/**
 * A session before the reviewer's own review: the tester's rating, comment and opinions stay
 * hidden, so the reviewer judges on their own. Only the tester's factual answers show.
 */
const reviewerSessionBlindOutputSchema = z.object({
  ...reviewerSessionCommonShape,
  blind: z.literal(true),
  factualTesterQuestions: z.array(reviewCampaignQuestionSchema),
  factualTesterAnswers: z.array(reviewCampaignAnswerSchema),
})

/** A session once the reviewer submitted: the tester's feedback and every review. */
const reviewerSessionFullOutputSchema = z.object({
  ...reviewerSessionCommonShape,
  blind: z.literal(false),
  testerPerSessionQuestions: z.array(reviewCampaignQuestionSchema),
  testerFeedback: z
    .object({
      overallRating: z.number(),
      comment: z.string().nullable(),
      answers: z.array(reviewCampaignAnswerSchema),
    })
    .nullable(),
  myReview: reviewerReviewOutputSchema,
  otherReviews: z.array(reviewerReviewOutputSchema),
})

export const reviewerSessionOutputSchema = z.discriminatedUnion("blind", [
  reviewerSessionBlindOutputSchema,
  reviewerSessionFullOutputSchema,
])

export type ReviewerSessionOutputDto = z.output<typeof reviewerSessionOutputSchema>

/** A rating from 1 to 5, an optional comment and the answers to the campaign's questions. */
export const ratedFeedbackInputSchema = z.strictObject({
  overallRating: z.number().int().min(1).max(RATING_MAX),
  comment: z.string().trim().nullable(),
  answers: z.array(reviewCampaignAnswerInputSchema),
})

export type RatedFeedbackInputDto = z.input<typeof ratedFeedbackInputSchema>

export const reviewerReviewParamsSchema = campaignSessionParamsSchema.extend({
  reviewId: z.uuid(),
})

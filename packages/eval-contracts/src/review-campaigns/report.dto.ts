import { z } from "zod"
import { reviewCampaignQuestionTypeSchema } from "./review-campaigns.dto"

/** Reads a campaign's report: its reviewers, and the owners and admins of its project. */
export const REVIEW_CAMPAIGN_REPORT_READ_PERMISSION = "review_campaign.report.read" as const

/** How the answers to one question spread. A free-text question has its answers, not buckets. */
export const campaignReportDistributionOutputSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  type: reviewCampaignQuestionTypeSchema,
  responseCount: z.number(),
  buckets: z.array(z.object({ label: z.string(), count: z.number() })),
  /** The answers to a free-text question, empty for the other types. */
  textAnswers: z.array(z.string()),
})

export type CampaignReportDistributionOutputDto = z.output<
  typeof campaignReportDistributionOutputSchema
>

/** A session of the report: the tester's rating against the reviewers'. */
export const campaignReportSessionOutputSchema = z.object({
  sessionId: z.uuid(),
  testerUserId: z.uuid(),
  startedAt: z.number(),
  testerRating: z.number().nullable(),
  reviewerRatings: z.array(z.number()),
  reviewerCount: z.number(),
  meanReviewerRating: z.number().nullable(),
  /** The highest reviewer rating minus the lowest: `null` under two reviewers. */
  reviewerRatingSpread: z.number().nullable(),
  /** The tester's answer to each question of the session feedback, by question id. */
  testerAnswers: z.record(z.string(), z.string()),
  /** One answer per review, in the order of `reviewerRatings`, empty when left blank. */
  reviewerAnswers: z.record(z.string(), z.array(z.string())),
  /** The tester's answer to each question of their final survey, by question id. */
  endOfPhaseAnswers: z.record(z.string(), z.string()),
})

export type CampaignReportSessionOutputDto = z.output<typeof campaignReportSessionOutputSchema>

export const campaignReportOutputSchema = z.object({
  /**
   * Whether the report holds the answers: the free-text answers and each session's answers. Only
   * who manages the campaign's project reads them: a reviewer reviews each session blind.
   */
  showsAnswers: z.boolean(),
  headline: z.object({
    sessionCount: z.number(),
    testerFeedbackCount: z.number(),
    reviewerReviewCount: z.number(),
    meanTesterRating: z.number().nullable(),
    meanReviewerRating: z.number().nullable(),
    meanEndOfPhaseRating: z.number().nullable(),
    participantCount: z.number(),
  }),
  testerPerSessionDistributions: z.array(campaignReportDistributionOutputSchema),
  testerEndOfPhaseDistributions: z.array(campaignReportDistributionOutputSchema),
  reviewerDistributions: z.array(campaignReportDistributionOutputSchema),
  sessionMatrix: z.array(campaignReportSessionOutputSchema),
})

export type CampaignReportOutputDto = z.output<typeof campaignReportOutputSchema>

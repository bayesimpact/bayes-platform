import {
  campaignReportFactory,
  campaignReportHeadlineFactory,
  campaignReportQuestionDistributionFactory,
  campaignReportSessionRowFactory,
} from "@/studio/features/review-campaigns/reports/report.factory"

const MS_PER_HOUR = 3_600_000
const now = Date.now()

export const mockHeadline = campaignReportHeadlineFactory.build({
  sessionCount: 42,
  testerFeedbackCount: 38,
  reviewerReviewCount: 21,
  meanTesterRating: 4.12,
  meanReviewerRating: 3.58,
  meanEndOfPhaseRating: 4.4,
  participantCount: 7,
})

export const mockTesterPerSessionDistributions = [
  campaignReportQuestionDistributionFactory.build({
    questionId: "tp-helpful",
    prompt: "Was the answer helpful?",
    type: "rating",
    responseCount: 38,
    buckets: [
      { label: "1", count: 1 },
      { label: "2", count: 3 },
      { label: "3", count: 9 },
      { label: "4", count: 14 },
      { label: "5", count: 11 },
    ],
  }),
  campaignReportQuestionDistributionFactory.build({
    questionId: "tp-notes",
    prompt: "Anything we should know?",
    type: "free-text",
    responseCount: 12,
    buckets: [],
  }),
  campaignReportQuestionDistributionFactory.build({
    questionId: "tp-escalated",
    prompt: "Did the agent escalate to a human?",
    type: "single-choice",
    responseCount: 38,
    buckets: [
      { label: "Yes", count: 4 },
      { label: "No", count: 34 },
    ],
  }),
]

export const mockReviewerDistributions = [
  campaignReportQuestionDistributionFactory.build({
    questionId: "rv-accurate",
    prompt: "How accurate was the agent's response?",
    type: "rating",
    responseCount: 21,
    buckets: [
      { label: "1", count: 0 },
      { label: "2", count: 3 },
      { label: "3", count: 8 },
      { label: "4", count: 7 },
      { label: "5", count: 3 },
    ],
  }),
  campaignReportQuestionDistributionFactory.build({
    questionId: "rv-escalate",
    prompt: "Would you escalate this conversation?",
    type: "single-choice",
    responseCount: 21,
    buckets: [
      { label: "Yes", count: 5 },
      { label: "No", count: 12 },
      { label: "Maybe", count: 4 },
    ],
  }),
]

export const mockEndOfPhaseDistributions = [
  campaignReportQuestionDistributionFactory.build({
    questionId: "eop-impression",
    prompt: "Overall, how would you rate the agent?",
    type: "rating",
    responseCount: 5,
    buckets: [
      { label: "1", count: 0 },
      { label: "2", count: 0 },
      { label: "3", count: 1 },
      { label: "4", count: 2 },
      { label: "5", count: 2 },
    ],
  }),
]

export const mockSessionMatrix = [
  campaignReportSessionRowFactory.build({
    sessionId: "session-4f7a2c8e-3b1d-4e5f-9a6c-8d2b1c3e4f5a",
    agentType: "conversation",
    testerUserId: "user-alice",
    startedAt: now - 2 * MS_PER_HOUR,
    testerRating: 5,
    reviewerRatings: [4, 5, 3],
    reviewerCount: 3,
    meanReviewerRating: 4,
    reviewerRatingSpread: 2,
  }),
  campaignReportSessionRowFactory.build({
    sessionId: "session-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    agentType: "conversation",
    testerUserId: "user-bob",
    startedAt: now - 5 * MS_PER_HOUR,
    testerRating: 2,
    reviewerRatings: [2, 4],
    reviewerCount: 2,
    meanReviewerRating: 3,
    reviewerRatingSpread: 2,
  }),
  campaignReportSessionRowFactory.build({
    sessionId: "session-form-8c3b1d5f-2a6e-4c7d-9b0a-1e2f3a4b5c6d",
    agentType: "form",
    testerUserId: "user-carol",
    startedAt: now - 26 * MS_PER_HOUR,
    testerRating: null,
    reviewerRatings: [],
    reviewerCount: 0,
    meanReviewerRating: null,
    reviewerRatingSpread: null,
  }),
]

export const mockCampaignReport = campaignReportFactory.build({
  campaignId: "campaign-support-q2",
  headline: mockHeadline,
  testerPerSessionDistributions: mockTesterPerSessionDistributions,
  testerEndOfPhaseDistributions: mockEndOfPhaseDistributions,
  reviewerDistributions: mockReviewerDistributions,
  sessionMatrix: mockSessionMatrix,
})

export const mockEmptyCampaignReport = campaignReportFactory.build({
  campaignId: "campaign-empty",
})

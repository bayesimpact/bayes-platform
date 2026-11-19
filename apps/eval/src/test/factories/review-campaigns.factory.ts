import {
  type CampaignInvitationOutputDto,
  type CampaignReportOutputDto,
  campaignInvitationOutputSchema,
  campaignReportOutputSchema,
  type ProjectAgentOutputDto,
  type ReviewCampaignDetailOutputDto,
  type ReviewCampaignQuestionDto,
  type ReviewerReviewOutputDto,
  type ReviewerSessionOutputDto,
  reviewCampaignDetailOutputSchema,
  reviewerReviewOutputSchema,
  type TesterSessionOutputDto,
  testerSessionOutputSchema,
} from "@caseai-connect/eval-contracts"

const DAY = 24 * 60 * 60 * 1000

/** A moment a number of days before now, at the same time of day. */
export const daysAgo = (days: number) => Date.now() - days * DAY

/** The questions a campaign asks, the same in every mocked campaign unless a test changes them. */
const perSessionQuestions: ReviewCampaignQuestionDto[] = [
  { id: "clarity", prompt: "Was the agent's answer clear?", type: "rating", required: true },
  {
    id: "addressed",
    prompt: "Did the agent address your question?",
    type: "single-choice",
    required: true,
    options: ["Yes", "Partially", "No"],
    isFactual: true,
  },
]
const endOfPhaseQuestions: ReviewCampaignQuestionDto[] = [
  {
    id: "satisfaction",
    prompt: "How satisfied are you with this agent overall?",
    type: "rating",
    required: true,
  },
  { id: "improve", prompt: "What should we improve first?", type: "free-text", required: false },
]
const reviewerQuestions: ReviewCampaignQuestionDto[] = [
  {
    id: "correct",
    prompt: "Were the agent's answers factually correct?",
    type: "rating",
    required: true,
  },
]

/** A campaign of an agent with its people, a draft unless `overrides` says otherwise. */
export function buildReviewCampaign(
  agent: ProjectAgentOutputDto,
  organizationId: string,
  overrides: Partial<ReviewCampaignDetailOutputDto> = {},
): ReviewCampaignDetailOutputDto {
  return reviewCampaignDetailOutputSchema.parse({
    id: crypto.randomUUID(),
    organizationId,
    projectId: agent.projectId,
    agentId: agent.id,
    name: "Support assistant pilot",
    description: "Try the assistant on the questions customers ask most, then rate its answers.",
    status: "draft",
    testerPerSessionQuestions: perSessionQuestions,
    testerEndOfPhaseQuestions: endOfPhaseQuestions,
    reviewerQuestions,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(2),
    memberships: [],
    aggregates: null,
    ...overrides,
  })
}

/** A person of a campaign, with the roles they hold in it. */
export function buildCampaignMembership(
  email: string,
  roles: ("tester" | "reviewer")[],
  overrides: { userHasSignedIn?: boolean } = {},
): ReviewCampaignDetailOutputDto["memberships"][number] {
  return {
    userId: crypto.randomUUID(),
    userEmail: email,
    userHasSignedIn: overrides.userHasSignedIn ?? true,
    roles: roles.map((role) => ({
      membershipId: crypto.randomUUID(),
      key: `review_campaign_${role}`,
    })),
  }
}

/** An invitation to a campaign that waits for an answer. */
export function buildCampaignInvitation(
  overrides: Partial<CampaignInvitationOutputDto> = {},
): CampaignInvitationOutputDto {
  return campaignInvitationOutputSchema.parse({
    id: crypto.randomUUID(),
    invitedEmail: "robin@example.org",
    role: "tester",
    status: "pending",
    invitedAt: daysAgo(1),
    ...overrides,
  })
}

/** A session a tester started in a campaign. */
export function buildTesterSession(
  agentId: string,
  overrides: Partial<TesterSessionOutputDto> = {},
): TesterSessionOutputDto {
  return testerSessionOutputSchema.parse({
    id: crypto.randomUUID(),
    agentId,
    feedbackStatus: "pending",
    createdAt: daysAgo(1),
    forms: [],
    ...overrides,
  })
}

/** A review a reviewer gave on a session. */
export function buildReviewerReview(
  overrides: Partial<ReviewerReviewOutputDto> = {},
): ReviewerReviewOutputDto {
  return reviewerReviewOutputSchema.parse({
    id: crypto.randomUUID(),
    reviewerUserId: crypto.randomUUID(),
    overallRating: 4,
    comment: "Accurate, but the second answer was longer than it needed to be.",
    answers: [{ questionId: "correct", value: 4 }],
    ...overrides,
  })
}

/** A tester's session as the reviewers of its campaign know it, whole: the handlers hide parts. */
export type ReviewSessionRecord = {
  sessionId: string
  testerUserId: string
  startedAt: number
  transcript: ReviewerSessionOutputDto["transcript"]
  testerFeedback: {
    overallRating: number
    comment: string | null
    answers: { questionId: string; value: string | number }[]
  } | null
  /** The reviews of the other reviewers. */
  otherReviews: ReviewerReviewOutputDto[]
  /** The review of the signed-in person, or `null` before they reviewed the session. */
  myReview: ReviewerReviewOutputDto | null
  formResult: { schema: Record<string, unknown>; value: Record<string, unknown> | null } | null
}

/** A session with a short exchange about plans, which a tester rated. */
export function buildReviewSession(
  overrides: Partial<ReviewSessionRecord> = {},
): ReviewSessionRecord {
  const startedAt = overrides.startedAt ?? daysAgo(2)
  return {
    sessionId: crypto.randomUUID(),
    testerUserId: crypto.randomUUID(),
    startedAt,
    transcript: [
      {
        id: crypto.randomUUID(),
        role: "user",
        content: "Which plan should a team of five pick?",
        createdAt: startedAt,
        sources: [],
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "For a team of five, the **Pro** plan fits best:\n\n- shared workspaces\n- five seats included\n\nThe Starter plan stops at one team.",
        createdAt: startedAt + 4000,
        sources: [
          {
            documentId: crypto.randomUUID(),
            documentTitle: "Pricing guide.pdf",
            documentSourceType: "project",
            chunks: [
              {
                chunkId: crypto.randomUUID(),
                partialContent: "The Pro plan covers unlimited teams…",
              },
            ],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        role: "user",
        content: "Can we switch later?",
        createdAt: startedAt + 60_000,
        sources: [],
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Yes. You can change plan at any time from the billing page.",
        createdAt: startedAt + 64_000,
        sources: [],
      },
    ],
    testerFeedback: {
      overallRating: 4,
      comment: "Clear answers, a bit long.",
      answers: [
        { questionId: "clarity", value: 4 },
        { questionId: "addressed", value: "Yes" },
      ],
    },
    otherReviews: [],
    myReview: null,
    formResult: null,
    ...overrides,
  }
}

/** A report with a few sessions and answers, checked against the contract. */
export function buildCampaignReport(
  overrides: Partial<CampaignReportOutputDto> = {},
): CampaignReportOutputDto {
  const testerUserId = crypto.randomUUID()
  return campaignReportOutputSchema.parse({
    headline: {
      sessionCount: 3,
      testerFeedbackCount: 2,
      reviewerReviewCount: 3,
      meanTesterRating: 4.5,
      meanReviewerRating: 3.67,
      meanEndOfPhaseRating: 4,
      participantCount: 2,
    },
    testerPerSessionDistributions: [
      {
        questionId: "clarity",
        prompt: "Was the agent's answer clear?",
        type: "rating",
        responseCount: 2,
        buckets: [
          { label: "1", count: 0 },
          { label: "2", count: 0 },
          { label: "3", count: 0 },
          { label: "4", count: 1 },
          { label: "5", count: 1 },
        ],
      },
      {
        questionId: "addressed",
        prompt: "Did the agent address your question?",
        type: "single-choice",
        responseCount: 2,
        buckets: [
          { label: "Yes", count: 1 },
          { label: "Partially", count: 1 },
          { label: "No", count: 0 },
        ],
      },
    ],
    testerEndOfPhaseDistributions: [
      {
        questionId: "satisfaction",
        prompt: "How satisfied are you with this agent overall?",
        type: "rating",
        responseCount: 1,
        buckets: [
          { label: "1", count: 0 },
          { label: "2", count: 0 },
          { label: "3", count: 0 },
          { label: "4", count: 1 },
          { label: "5", count: 0 },
        ],
      },
      {
        questionId: "improve",
        prompt: "What should we improve first?",
        type: "free-text",
        responseCount: 1,
        buckets: [],
      },
    ],
    reviewerDistributions: [
      {
        questionId: "correct",
        prompt: "Were the agent's answers factually correct?",
        type: "rating",
        responseCount: 3,
        buckets: [
          { label: "1", count: 0 },
          { label: "2", count: 0 },
          { label: "3", count: 1 },
          { label: "4", count: 2 },
          { label: "5", count: 0 },
        ],
      },
    ],
    sessionMatrix: [
      {
        sessionId: crypto.randomUUID(),
        testerUserId,
        startedAt: daysAgo(1),
        testerRating: 5,
        reviewerRatings: [3, 5],
        reviewerCount: 2,
        meanReviewerRating: 4,
        reviewerRatingSpread: 2,
      },
      {
        sessionId: crypto.randomUUID(),
        testerUserId,
        startedAt: daysAgo(2),
        testerRating: 4,
        reviewerRatings: [3],
        reviewerCount: 1,
        meanReviewerRating: 3,
        reviewerRatingSpread: null,
      },
      {
        sessionId: crypto.randomUUID(),
        testerUserId: crypto.randomUUID(),
        startedAt: daysAgo(3),
        testerRating: null,
        reviewerRatings: [],
        reviewerCount: 0,
        meanReviewerRating: null,
        reviewerRatingSpread: null,
      },
    ],
    ...overrides,
  })
}

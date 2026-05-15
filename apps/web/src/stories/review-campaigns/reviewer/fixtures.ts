import type {
  GetReviewerSessionResponseDto,
  ListMyReviewCampaignsResponseDto,
  ReviewerSessionFullDto,
} from "@caseai-connect/api-contracts"
import {
  reviewerAgentSnapshotFactory,
  reviewerSessionBlindFactory,
  reviewerSessionFullFactory,
  reviewerSessionListItemFactory,
  reviewerSessionReviewFactory,
  reviewerSessionTranscriptMessageFactory,
} from "@/reviewer/features/review-campaigns/reviewer.factory"
import { reviewCampaignQuestionFactory } from "@/studio/features/review-campaigns/review-campaign.factory"
import {
  myReviewCampaignFactory,
  testerAgentSnapshotFactory,
  testerContextFactory,
} from "@/tester/features/review-campaigns/tester.factory"
import { mockProject } from "../fixtures"

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const now = Date.now()

export const mockAgent = reviewerAgentSnapshotFactory.build({
  id: "agent-1",
  name: "Helpful Assistant",
  type: "conversation",
})

export const mockReviewerQuestions = [
  reviewCampaignQuestionFactory.build({
    id: "rv-1",
    prompt: "How accurate was the agent's response?",
    type: "rating",
    required: true,
  }),
  reviewCampaignQuestionFactory.build({
    id: "rv-2",
    prompt: "Would you escalate this conversation?",
    type: "single-choice",
    required: true,
    options: ["Yes", "No", "Maybe"],
  }),
  reviewCampaignQuestionFactory.build({
    id: "rv-3",
    prompt: "Anything else to note?",
    type: "free-text",
    required: false,
  }),
]

export const mockFactualQuestions = [
  reviewCampaignQuestionFactory.build({
    id: "ps-escalated",
    prompt: "Did the agent escalate to a human?",
    type: "single-choice",
    required: true,
    options: ["Yes", "No"],
    isFactual: true,
  }),
  reviewCampaignQuestionFactory.build({
    id: "ps-sources",
    prompt: "How many sources were cited?",
    type: "rating",
    required: false,
    isFactual: true,
  }),
]

export const mockTesterPerSessionQuestions = [
  ...mockFactualQuestions,
  reviewCampaignQuestionFactory.build({
    id: "ps-helpful",
    prompt: "Was the answer helpful?",
    type: "rating",
    required: true,
  }),
  reviewCampaignQuestionFactory.build({
    id: "ps-notes",
    prompt: "Anything we should know?",
    type: "free-text",
    required: false,
  }),
]

export const mockFactualAnswers = [
  { questionId: "ps-escalated", value: "No" },
  { questionId: "ps-sources", value: 3 },
]

export const mockAllTesterAnswers = [
  ...mockFactualAnswers,
  { questionId: "ps-helpful", value: 2 },
  { questionId: "ps-notes", value: "Agent kept rephrasing the same answer." },
]

export const mockTranscript = [
  reviewerSessionTranscriptMessageFactory.build({
    id: "msg-1",
    role: "user",
    content: "How do I export my data?",
    createdAt: now - 30 * MS_PER_MINUTE,
  }),
  reviewerSessionTranscriptMessageFactory.build({
    id: "msg-2",
    role: "assistant",
    content:
      "You can export by going to Settings → Data → Export. I'll walk you through each step.",
    createdAt: now - 29 * MS_PER_MINUTE,
  }),
  reviewerSessionTranscriptMessageFactory.build({
    id: "msg-3",
    role: "user",
    content: "I don't see a Data menu.",
    createdAt: now - 28 * MS_PER_MINUTE,
  }),
  reviewerSessionTranscriptMessageFactory.build({
    id: "msg-4",
    role: "assistant",
    content:
      "Which plan are you on? The Data menu is only visible to workspace admins on paid plans.",
    createdAt: now - 27 * MS_PER_MINUTE,
  }),
]

const baseSessionId = "session-1"
const baseStartedAt = now - MS_PER_HOUR
const baseTesterUserId = "user-4f7a2c8e-3b1d-4e5f-9a6c-8d2b1c3e4f5a"

const mockFormSchema = {
  type: "object",
  properties: {
    fullName: { type: "string", title: "Full name" },
    email: { type: "string", title: "Email address" },
    role: { type: "string", title: "Role at company" },
    teamSize: { type: "number", title: "Team size" },
    interests: { type: "array", title: "Topics of interest" },
  },
} as const

const mockFormAgent = reviewerAgentSnapshotFactory.build({
  id: "agent-form-1",
  name: "Intake Form Agent",
  type: "form",
})

const mockFormTranscript = [
  reviewerSessionTranscriptMessageFactory.build({
    id: "fm-1",
    role: "assistant",
    content: "Hi! Let's get you set up. What's your full name?",
    createdAt: now - 20 * MS_PER_MINUTE,
  }),
  reviewerSessionTranscriptMessageFactory.build({
    id: "fm-2",
    role: "user",
    content: "Jane Doe",
    createdAt: now - 19 * MS_PER_MINUTE,
  }),
  reviewerSessionTranscriptMessageFactory.build({
    id: "fm-3",
    role: "assistant",
    content: "Thanks, Jane. What's your email?",
    createdAt: now - 18 * MS_PER_MINUTE,
  }),
  reviewerSessionTranscriptMessageFactory.build({
    id: "fm-4",
    role: "user",
    content: "jane@example.com",
    createdAt: now - 17 * MS_PER_MINUTE,
  }),
  reviewerSessionTranscriptMessageFactory.build({
    id: "fm-5",
    role: "assistant",
    content: "Got it. What's your role at the company?",
    createdAt: now - 16 * MS_PER_MINUTE,
  }),
  reviewerSessionTranscriptMessageFactory.build({
    id: "fm-6",
    role: "user",
    content: "Product manager.",
    createdAt: now - 15 * MS_PER_MINUTE,
  }),
]

const formSessionId = "session-form-1"
const formTesterUserId = "user-form-8c3b1d5f-2a6e-4c7d-9b0a-1e2f3a4b5c6d"

export const mockBlindSession = reviewerSessionBlindFactory.build({
  sessionId: baseSessionId,
  sessionType: "conversation",
  testerUserId: baseTesterUserId,
  startedAt: baseStartedAt,
  agent: mockAgent,
  transcript: mockTranscript,
  reviewerQuestions: mockReviewerQuestions,
  factualTesterQuestions: mockFactualQuestions,
  factualTesterAnswers: mockFactualAnswers,
})

export const mockBlindSessionWithOtherReviewers = reviewerSessionBlindFactory.build({
  ...mockBlindSession,
  otherReviewerCount: 2,
})

const mockMyReview = reviewerSessionReviewFactory
  .transient({ campaign: { id: "campaign-1" } })
  .build({
    id: "review-mine",
    sessionId: baseSessionId,
    sessionType: "conversation",
    reviewerUserId: "user-mine",
    overallRating: 4,
    comment: "Close but could be more concise.",
    answers: [
      { questionId: "rv-1", value: 4 },
      { questionId: "rv-2", value: "No" },
    ],
    submittedAt: now - 2 * MS_PER_HOUR,
    createdAt: now - 2 * MS_PER_HOUR,
    updatedAt: now - 2 * MS_PER_HOUR,
  })

const mockOtherReview = reviewerSessionReviewFactory
  .transient({ campaign: { id: "campaign-1" } })
  .build({
    id: "review-other",
    sessionId: baseSessionId,
    sessionType: "conversation",
    reviewerUserId: "user-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    overallRating: 3,
    comment: "Agent misinterpreted the plan context.",
    answers: [
      { questionId: "rv-1", value: 3 },
      { questionId: "rv-2", value: "Maybe" },
      { questionId: "rv-3", value: "Plan tier matters here." },
    ],
    submittedAt: now - MS_PER_HOUR,
    createdAt: now - MS_PER_HOUR,
    updatedAt: now - MS_PER_HOUR,
  })

export const mockFullSession: ReviewerSessionFullDto = reviewerSessionFullFactory.build({
  sessionId: baseSessionId,
  sessionType: "conversation",
  testerUserId: baseTesterUserId,
  startedAt: baseStartedAt,
  agent: mockAgent,
  transcript: mockTranscript,
  reviewerQuestions: mockReviewerQuestions,
  testerPerSessionQuestions: mockTesterPerSessionQuestions,
  testerFeedback: {
    overallRating: 2,
    comment: "Agent kept rephrasing instead of answering.",
    answers: mockAllTesterAnswers,
  },
  myReview: mockMyReview,
  otherReviews: [],
})

export const mockFullSessionWithOtherReviewers = reviewerSessionFullFactory.build({
  ...mockFullSession,
  otherReviewerCount: 1,
  otherReviews: [mockOtherReview],
})

export const mockFullSessionNoTesterFeedback = reviewerSessionFullFactory.build({
  ...mockFullSession,
  testerFeedback: null,
})

export const mockBlindFormSession = reviewerSessionBlindFactory.build({
  sessionId: formSessionId,
  sessionType: "form",
  testerUserId: formTesterUserId,
  startedAt: baseStartedAt,
  agent: mockFormAgent,
  transcript: mockFormTranscript,
  reviewerQuestions: mockReviewerQuestions,
  formResult: {
    schema: mockFormSchema as Record<string, unknown>,
    value: {
      fullName: "Jane Doe",
      email: "jane@example.com",
      role: "Product manager",
    },
  },
  factualTesterQuestions: mockFactualQuestions,
  factualTesterAnswers: mockFactualAnswers,
})

export const mockFullFormSession = reviewerSessionFullFactory.build({
  sessionId: formSessionId,
  sessionType: "form",
  testerUserId: formTesterUserId,
  startedAt: baseStartedAt,
  agent: mockFormAgent,
  transcript: mockFormTranscript,
  reviewerQuestions: mockReviewerQuestions,
  formResult: {
    schema: mockFormSchema as Record<string, unknown>,
    value: {
      fullName: "Jane Doe",
      email: "jane@example.com",
      role: "Product manager",
    },
  },
  testerPerSessionQuestions: mockTesterPerSessionQuestions,
  testerFeedback: {
    overallRating: 4,
    comment: "Agent captured most fields cleanly.",
    answers: mockAllTesterAnswers,
  },
  myReview: { ...mockMyReview, sessionId: formSessionId, sessionType: "form" },
  otherReviews: [],
})

export const mockFullFormSessionAbandoned = reviewerSessionFullFactory.build({
  ...mockFullFormSession,
  formResult: {
    schema: mockFormSchema as Record<string, unknown>,
    value: null,
  },
})

export type ReviewerSessionFixture = GetReviewerSessionResponseDto

export const mockCampaignContext = testerContextFactory.build({
  id: "campaign-support-q2",
  name: "Support assistant — Q2 review",
  description: "Evaluate the new support assistant handling billing and plan questions.",
  status: "active",
  agent: testerAgentSnapshotFactory.build({
    id: mockAgent.id,
    name: mockAgent.name,
    type: mockAgent.type,
    greetingMessage: "Hi! Ask me anything about your plan or billing.",
  }),
  testerPerSessionQuestions: mockTesterPerSessionQuestions,
  testerEndOfPhaseQuestions: [],
})

export const mockReviewerSessions = [
  reviewerSessionListItemFactory.build({
    sessionId: "session-4f7a2c8e-3b1d-4e5f-9a6c-8d2b1c3e4f5a",
    sessionType: "conversation",
    testerUserId: "user-alice",
    startedAt: now - 2 * MS_PER_HOUR,
    messageCount: 12,
    reviewerCount: 1,
    callerHasReviewed: true,
  }),
  reviewerSessionListItemFactory.build({
    sessionId: "session-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    sessionType: "conversation",
    testerUserId: "user-bob",
    startedAt: now - 5 * MS_PER_HOUR,
    messageCount: 8,
  }),
  reviewerSessionListItemFactory.build({
    sessionId: "session-form-8c3b1d5f-2a6e-4c7d-9b0a-1e2f3a4b5c6d",
    sessionType: "form",
    testerUserId: "user-carol",
    startedAt: now - 26 * MS_PER_HOUR,
    messageCount: 18,
    reviewerCount: 2,
  }),
  reviewerSessionListItemFactory.build({
    sessionId: "session-mine-9b0a1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
    sessionType: "conversation",
    testerUserId: "user-mine",
    startedAt: now - 48 * MS_PER_HOUR,
    messageCount: 6,
    callerIsSessionOwner: true,
  }),
]

export const mockMyReviewerCampaigns: ListMyReviewCampaignsResponseDto["reviewCampaigns"] = [
  myReviewCampaignFactory.transient({ project: mockProject }).build({
    id: mockCampaignContext.id,
    agentId: mockAgent.id,
    name: mockCampaignContext.name,
    description: mockCampaignContext.description,
    status: "active",
    createdAt: now - 3 * MS_PER_HOUR,
  }),
  myReviewCampaignFactory.transient({ project: mockProject }).build({
    id: "campaign-form-rollout",
    agentId: "agent-form-1",
    name: "Onboarding form rollout",
    description: "Second-pass review of the onboarding form agent.",
    status: "active",
    createdAt: now - 6 * MS_PER_HOUR,
  }),
]

import { reviewCampaignQuestionFactory } from "@/studio/features/review-campaigns/review-campaign.factory"
import {
  myReviewCampaignFactory,
  myTesterSessionSummaryFactory,
  testerAgentSnapshotFactory,
  testerCampaignSurveyFactory,
  testerContextFactory,
} from "@/tester/features/review-campaigns/tester.factory"
import type { MyTesterSessionSummary } from "@/tester/features/review-campaigns/tester.models"
import { mockProject } from "../fixtures"

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000
const now = Date.now()

export const mockPerSessionQuestions = [
  reviewCampaignQuestionFactory.build({
    id: "ps-1",
    prompt: "Were the agent's answers clear?",
    type: "rating",
    required: true,
  }),
  reviewCampaignQuestionFactory.build({
    id: "ps-2",
    prompt: "Did the agent address your question?",
    type: "single-choice",
    required: true,
    options: ["Yes", "Partially", "No"],
  }),
  reviewCampaignQuestionFactory.build({
    id: "ps-3",
    prompt: "Anything we should know about this session?",
    type: "free-text",
    required: false,
  }),
]

export const mockEndOfPhaseQuestions = [
  reviewCampaignQuestionFactory.build({
    id: "eop-1",
    prompt: "How satisfied are you with the agent overall?",
    type: "rating",
    required: true,
  }),
  reviewCampaignQuestionFactory.build({
    id: "eop-2",
    prompt: "Would you recommend this agent to a colleague?",
    type: "single-choice",
    required: false,
    options: ["Definitely", "Maybe", "No"],
  }),
  reviewCampaignQuestionFactory.build({
    id: "eop-3",
    prompt: "What would most improve the experience?",
    type: "free-text",
    required: false,
  }),
]

export const mockTesterContext = testerContextFactory.build({
  id: "campaign-active",
  name: "Helpful Assistant — first pass",
  description: "Help us evaluate the new assistant.",
  status: "active",
  agent: testerAgentSnapshotFactory.build({
    id: "agent-1",
    name: "Helpful Assistant",
    type: "conversation",
    greetingMessage: "Hi! Ask me anything about your account.",
  }),
  testerPerSessionQuestions: mockPerSessionQuestions,
  testerEndOfPhaseQuestions: mockEndOfPhaseQuestions,
})

export const mockMyCampaigns = [
  myReviewCampaignFactory.transient({ project: mockProject }).build({
    id: mockTesterContext.id,
    name: mockTesterContext.name,
    description: mockTesterContext.description,
    status: "active",
    agentId: mockTesterContext.agent.id,
    createdAt: now - 3 * MS_PER_DAY,
  }),
  myReviewCampaignFactory.transient({ project: mockProject }).build({
    id: "campaign-active-2",
    name: "Scheduling Bot — sprint 14",
    description: "Two-week rollout evaluation.",
    status: "active",
    agentId: "agent-2",
    createdAt: now - 6 * MS_PER_DAY,
  }),
]

export const mockSessions: MyTesterSessionSummary[] = [
  myTesterSessionSummaryFactory.build({
    id: "session-pending",
    createdAt: now - 2 * MS_PER_HOUR,
    feedbackStatus: "pending",
    agentType: "conversation",
  }),
  myTesterSessionSummaryFactory.build({
    id: "session-submitted",
    createdAt: now - 1 * MS_PER_DAY,
    feedbackStatus: "submitted",
    agentType: "conversation",
  }),
  myTesterSessionSummaryFactory.build({
    id: "session-abandoned",
    createdAt: now - 2 * MS_PER_DAY,
    feedbackStatus: "abandoned",
    agentType: "conversation",
  }),
]

export const mockSessionSummaries = mockSessions.map((session) =>
  myTesterSessionSummaryFactory.build({
    ...session,
    feedbackStatus: session.feedbackStatus === "abandoned" ? "pending" : session.feedbackStatus,
  }),
)

export const mockSurvey = testerCampaignSurveyFactory
  .transient({ campaign: mockTesterContext, user: { id: "user-mock" } })
  .build({
    id: "survey-mock",
    overallRating: 4,
    comment: "Overall good",
    submittedAt: now - MS_PER_HOUR,
    createdAt: now - MS_PER_HOUR,
    updatedAt: now - MS_PER_HOUR,
  })

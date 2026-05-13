import type {
  ReviewCampaignDto,
  ReviewCampaignMembershipDto,
  ReviewCampaignQuestionDto,
} from "@caseai-connect/api-contracts"
import type { CampaignFormAgentOption } from "@/studio/features/review-campaigns/components/CampaignForm"

const MS_PER_DAY = 86_400_000
const now = Date.now()

export const mockAgents: CampaignFormAgentOption[] = [
  { id: "agent-1", name: "Support assistant" },
  { id: "agent-2", name: "Scheduling bot" },
  { id: "agent-3", name: "Intake form agent" },
]

export const mockPerSessionQuestions: ReviewCampaignQuestionDto[] = [
  {
    id: "q-ps-1",
    prompt: "Were the agent's answers clear?",
    type: "rating",
    required: true,
  },
  {
    id: "q-ps-2",
    prompt: "Did the agent address your question?",
    type: "single-choice",
    required: true,
    options: ["Yes", "Partially", "No"],
  },
  {
    id: "q-ps-3",
    prompt: "Anything we should know about this session?",
    type: "free-text",
    required: false,
  },
]

export const mockEndOfPhaseQuestions: ReviewCampaignQuestionDto[] = [
  {
    id: "q-eop-1",
    prompt: "Overall, how satisfied are you with the agent?",
    type: "rating",
    required: true,
  },
  {
    id: "q-eop-2",
    prompt: "Would you recommend this agent to a colleague?",
    type: "single-choice",
    required: false,
    options: ["Definitely", "Maybe", "No"],
  },
]

export const mockReviewerQuestions: ReviewCampaignQuestionDto[] = [
  {
    id: "q-rv-1",
    prompt: "Were the agent's answers factually correct?",
    type: "rating",
    required: true,
  },
  {
    id: "q-rv-2",
    prompt: "Did the agent stay within its declared scope?",
    type: "single-choice",
    required: true,
    options: ["Yes", "Drifted once", "Drifted multiple times"],
  },
]

const baseCampaign = {
  organizationId: "org-1",
  projectId: "proj-1",
  agentId: "agent-1",
  testerPerSessionQuestions: mockPerSessionQuestions,
  testerEndOfPhaseQuestions: mockEndOfPhaseQuestions,
  reviewerQuestions: mockReviewerQuestions,
}

export const mockDraftCampaign: ReviewCampaignDto = {
  ...baseCampaign,
  id: "campaign-draft",
  name: "Support assistant — first pass",
  description: "Internal dogfood before rolling out to customers.",
  status: "draft",
  activatedAt: null,
  closedAt: null,
  createdAt: now - 3 * MS_PER_DAY,
  updatedAt: now - 1 * MS_PER_DAY,
}

export const mockActiveCampaign: ReviewCampaignDto = {
  ...baseCampaign,
  id: "campaign-active",
  name: "Scheduling bot — sprint 14",
  description: "Collecting tester feedback during the two-week rollout.",
  status: "active",
  activatedAt: now - 5 * MS_PER_DAY,
  closedAt: null,
  createdAt: now - 10 * MS_PER_DAY,
  updatedAt: now - 2 * MS_PER_DAY,
  agentId: "agent-2",
}

export const mockClosedCampaign: ReviewCampaignDto = {
  ...baseCampaign,
  id: "campaign-closed",
  name: "Intake agent — v0 evaluation",
  description: "Wrapped up; results in the aggregate view.",
  status: "closed",
  activatedAt: now - 40 * MS_PER_DAY,
  closedAt: now - 7 * MS_PER_DAY,
  createdAt: now - 60 * MS_PER_DAY,
  updatedAt: now - 7 * MS_PER_DAY,
  agentId: "agent-3",
}

export const mockMemberships: ReviewCampaignMembershipDto[] = [
  {
    id: "membership-1",
    campaignId: "campaign-active",
    userId: "user-1",
    userEmail: "alice@example.com",
    role: "tester",
    acceptedAt: now - 4 * MS_PER_DAY,
  },
  {
    id: "membership-2",
    campaignId: "campaign-active",
    userId: "user-2",
    userEmail: "bob@example.com",
    role: "tester",
    acceptedAt: null,
  },
  {
    id: "membership-3",
    campaignId: "campaign-active",
    userId: "user-3",
    userEmail: "carol@example.com",
    role: "reviewer",
    acceptedAt: now - 1 * MS_PER_DAY,
  },
]

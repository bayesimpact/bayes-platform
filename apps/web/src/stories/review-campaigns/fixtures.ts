import type { ReviewCampaignMembershipDto } from "@caseai-connect/api-contracts"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import {
  campaignFormAgentOptionFactory,
  reviewCampaignFactory,
  reviewCampaignMembershipFactory,
  reviewCampaignQuestionFactory,
} from "@/studio/features/review-campaigns/review-campaign.factory"

const MS_PER_DAY = 86_400_000
const now = Date.now()

export const mockOrganization = organizationFactory.build({ id: "org-1" })

export const mockProject = projectFactory
  .transient({ organization: mockOrganization })
  .build({ id: "proj-1", name: "Demo project" })

export const mockAgents = [
  campaignFormAgentOptionFactory.build({ id: "agent-1", name: "Helpful Assistant" }),
  campaignFormAgentOptionFactory.build({ id: "agent-2", name: "Scheduling Bot" }),
  campaignFormAgentOptionFactory.build({ id: "agent-3", name: "Intake Form Agent" }),
]

export const mockPerSessionQuestions = [
  reviewCampaignQuestionFactory.build({
    id: "q-ps-1",
    prompt: "Were the agent's answers clear?",
    type: "rating",
    required: true,
  }),
  reviewCampaignQuestionFactory.build({
    id: "q-ps-2",
    prompt: "Did the agent address your question?",
    type: "single-choice",
    required: true,
    options: ["Yes", "Partially", "No"],
  }),
  reviewCampaignQuestionFactory.build({
    id: "q-ps-3",
    prompt: "Anything we should know about this session?",
    type: "free-text",
    required: false,
  }),
]

export const mockEndOfPhaseQuestions = [
  reviewCampaignQuestionFactory.build({
    id: "q-eop-1",
    prompt: "Overall, how satisfied are you with the agent?",
    type: "rating",
    required: true,
  }),
  reviewCampaignQuestionFactory.build({
    id: "q-eop-2",
    prompt: "Would you recommend this agent to a colleague?",
    type: "single-choice",
    required: false,
    options: ["Definitely", "Maybe", "No"],
  }),
]

export const mockReviewerQuestions = [
  reviewCampaignQuestionFactory.build({
    id: "q-rv-1",
    prompt: "Were the agent's answers factually correct?",
    type: "rating",
    required: true,
  }),
  reviewCampaignQuestionFactory.build({
    id: "q-rv-2",
    prompt: "Did the agent stay within its declared scope?",
    type: "single-choice",
    required: true,
    options: ["Yes", "Drifted once", "Drifted multiple times"],
  }),
]

const campaignDefaults = {
  testerPerSessionQuestions: mockPerSessionQuestions,
  testerEndOfPhaseQuestions: mockEndOfPhaseQuestions,
  reviewerQuestions: mockReviewerQuestions,
}

export const mockDraftCampaign = reviewCampaignFactory.transient({ project: mockProject }).build({
  ...campaignDefaults,
  id: "campaign-draft",
  name: "Helpful Assistant — first pass",
  description: "Internal dogfood before rolling out to colleagues.",
  status: "draft",
  agentId: "agent-1",
  createdAt: now - 3 * MS_PER_DAY,
  updatedAt: now - 1 * MS_PER_DAY,
})

export const mockActiveCampaign = reviewCampaignFactory.transient({ project: mockProject }).build({
  ...campaignDefaults,
  id: "campaign-active",
  name: "Scheduling Bot — sprint 14",
  description: "Collecting tester feedback during the two-week rollout.",
  status: "active",
  agentId: "agent-2",
  activatedAt: now - 5 * MS_PER_DAY,
  createdAt: now - 10 * MS_PER_DAY,
  updatedAt: now - 2 * MS_PER_DAY,
})

export const mockClosedCampaign = reviewCampaignFactory.transient({ project: mockProject }).build({
  ...campaignDefaults,
  id: "campaign-closed",
  name: "Intake Form Agent — v0 evaluation",
  description: "Wrapped up; results in the aggregate view.",
  status: "closed",
  agentId: "agent-3",
  activatedAt: now - 40 * MS_PER_DAY,
  closedAt: now - 7 * MS_PER_DAY,
  createdAt: now - 60 * MS_PER_DAY,
  updatedAt: now - 7 * MS_PER_DAY,
})

export const mockMemberships: ReviewCampaignMembershipDto[] = [
  reviewCampaignMembershipFactory.transient({ campaign: mockActiveCampaign }).build({
    id: "membership-1",
    userId: "user-1",
    userEmail: "alice@example.com",
    role: "tester",
  }),
  reviewCampaignMembershipFactory.transient({ campaign: mockActiveCampaign }).build({
    id: "membership-2",
    userId: "user-2",
    userEmail: "bob@example.com",
    role: "tester",
  }),
  reviewCampaignMembershipFactory.transient({ campaign: mockActiveCampaign }).build({
    id: "membership-3",
    userId: "user-3",
    userEmail: "carol@example.com",
    role: "reviewer",
  }),
]

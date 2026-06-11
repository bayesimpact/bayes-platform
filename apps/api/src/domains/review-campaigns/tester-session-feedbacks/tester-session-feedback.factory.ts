import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import type { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignAgentType } from "../review-campaigns.types"
import type { TesterSessionFeedback } from "./tester-session-feedback.entity"

type TesterSessionFeedbackTransientParams = RequiredScopeTransientParams & {
  campaign: ReviewCampaign
  session: ConversationAgentSession | ExtractionAgentSession | FormAgentSession
  agentType: ReviewCampaignAgentType
}

class TesterSessionFeedbackFactory extends Factory<
  TesterSessionFeedback,
  TesterSessionFeedbackTransientParams
> {}

export const testerSessionFeedbackFactory = TesterSessionFeedbackFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.campaign) {
      throw new Error("campaign transient is required")
    }
    if (!transientParams.session) {
      throw new Error("session transient is required")
    }
    if (!transientParams.agentType) {
      throw new Error("agentType transient is required")
    }

    const agentType = transientParams.agentType
    const conversationAgentSession =
      agentType === "conversation" ? (transientParams.session as ConversationAgentSession) : null
    const formAgentSession =
      agentType === "form" ? (transientParams.session as FormAgentSession) : null

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      campaignId: transientParams.campaign.id,
      campaign: transientParams.campaign,
      sessionId: transientParams.session.id,
      agentType,
      conversationAgentSession,
      formAgentSession,
      overallRating: params.overallRating ?? 5,
      comment: params.comment ?? null,
      answers: params.answers || [],
    } satisfies TesterSessionFeedback
  },
)

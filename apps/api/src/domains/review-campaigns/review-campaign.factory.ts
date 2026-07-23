import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { ReviewCampaign } from "./review-campaign.entity"

type ReviewCampaignTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  agentSettings: AgentSettings
}

class ReviewCampaignFactory extends Factory<ReviewCampaign, ReviewCampaignTransientParams> {
  draft() {
    return this.params({ status: "draft", activatedAt: null, closedAt: null })
  }

  active() {
    return this.params({ status: "active", activatedAt: new Date(), closedAt: null })
  }

  closed() {
    return this.params({ status: "closed", activatedAt: new Date(), closedAt: new Date() })
  }
}

export const reviewCampaignFactory = ReviewCampaignFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.agent) {
      throw new Error("agent transient is required")
    }
    if (!transientParams.agentSettings) {
      throw new Error("agentSettings transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      project: transientParams.project,
      agentId: transientParams.agent.id,
      agent: transientParams.agent,
      agentSettingsId: transientParams.agentSettings.id,
      agentSettings: transientParams.agentSettings,
      name: params.name || `Test Review Campaign ${sequence}`,
      description: params.description ?? null,
      status: params.status || "draft",
      testerPerSessionQuestions: params.testerPerSessionQuestions || [],
      testerEndOfPhaseQuestions: params.testerEndOfPhaseQuestions || [],
      reviewerQuestions: params.reviewerQuestions || [],
      activatedAt: params.activatedAt ?? null,
      closedAt: params.closedAt ?? null,
      testerSessionFeedbacks: params.testerSessionFeedbacks || [],
      testerCampaignSurveys: params.testerCampaignSurveys || [],
      reviewerSessionReviews: params.reviewerSessionReviews || [],
      conversationAgentSessions: params.conversationAgentSessions || [],
      extractionAgentSessions: params.extractionAgentSessions || [],
    } satisfies ReviewCampaign
  },
)

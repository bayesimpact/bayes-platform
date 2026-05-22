import { conversationAgentSessionsSlice } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.slice"
import { extractionAgentSessionsMiddleware } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.middleware"
import { extractionAgentSessionsSlice } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.slice"
import { formAgentSessionsSlice } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.slice"
import { agentSessionMessagesMiddleware } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.middleware"
import { agentSessionMessagesSlice } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.slice"
import { baseAgentSessionsMiddleware } from "@/common/features/agents/agent-sessions/shared/base-agent-session/base-agent-sessions.middleware"
import { agentsMiddleware } from "@/common/features/agents/agents.middleware"
import { agentsSlice } from "@/common/features/agents/agents.slice"
import { projectsSlice } from "@/common/features/projects/projects.slice"
import { agentEmbedConfigsMiddleware } from "@/studio/features/agent-embed-configs/agent-embed-configs.middleware"
import { agentEmbedConfigsSlice } from "@/studio/features/agent-embed-configs/agent-embed-configs.slice"
import { agentMembershipsMiddleware } from "@/studio/features/agent-memberships/agent-memberships.middleware"
import { agentMembershipsSlice } from "@/studio/features/agent-memberships/agent-memberships.slice"
import { agentMessageFeedbackMiddleware } from "@/studio/features/agent-message-feedback/agent-message-feedback.middleware"
import { agentMessageFeedbackSlice } from "@/studio/features/agent-message-feedback/agent-message-feedback.slice"
import { agentAnalyticsMiddleware } from "@/studio/features/analytics/agent/agent-analytics.middleware"
import { agentAnalyticsSlice } from "@/studio/features/analytics/agent/agent-analytics.slice"
import { projectAnalyticsMiddleware } from "@/studio/features/analytics/project/analytics.middleware"
import { projectAnalyticsSlice } from "@/studio/features/analytics/project/analytics.slice"
import { documentTagsMiddleware } from "@/studio/features/document-tags/document-tags.middleware"
import { documentTagsSlice } from "@/studio/features/document-tags/document-tags.slice"
import { evaluationReportsMiddleware } from "@/studio/features/evaluation-reports/evaluation-reports.middleware"
import { evaluationReportsSlice } from "@/studio/features/evaluation-reports/evaluation-reports.slice"
import { evaluationsMiddleware } from "@/studio/features/evaluations/evaluations.middleware"
import { evaluationsSlice } from "@/studio/features/evaluations/evaluations.slice"
import { projectMembershipsMiddleware } from "@/studio/features/project-memberships/project-memberships.middleware"
import { projectMembershipsSlice } from "@/studio/features/project-memberships/project-memberships.slice"
import { reviewCampaignsMiddleware } from "@/studio/features/review-campaigns/review-campaigns.middleware"
import { reviewCampaignsSlice } from "@/studio/features/review-campaigns/review-campaigns.slice"
import { createSliceManager } from "../../common/store/dynamic-middleware"
import { studioAgentsMiddleware } from "../features/agents/agents.middleware"
import { documentsMiddleware } from "../features/documents/documents.middleware"
import { documentsSlice } from "../features/documents/documents.slice"
import { studioProjectsMiddleware } from "../features/projects/projects.middleware"
import { reviewCampaignsReportsMiddleware } from "../features/review-campaigns/reports/reports.middleware"
import { reviewCampaignsReportsSlice } from "../features/review-campaigns/reports/reports.slice"
import { currentIdsSlice } from "./currentIds.slice"

const studioMiddlewareList = [
  agentAnalyticsMiddleware,
  agentEmbedConfigsMiddleware,
  agentMembershipsMiddleware,
  agentMessageFeedbackMiddleware,
  agentSessionMessagesMiddleware,
  agentsMiddleware,
  baseAgentSessionsMiddleware,
  documentsMiddleware,
  documentTagsMiddleware,
  evaluationReportsMiddleware,
  evaluationsMiddleware,
  extractionAgentSessionsMiddleware,
  projectAnalyticsMiddleware,
  projectMembershipsMiddleware,
  reviewCampaignsMiddleware,
  reviewCampaignsReportsMiddleware,
  studioAgentsMiddleware,
  studioProjectsMiddleware,
]

export const studioSliceList = [
  agentAnalyticsSlice,
  agentEmbedConfigsSlice,
  agentMembershipsSlice,
  agentMessageFeedbackSlice,
  agentSessionMessagesSlice,
  agentsSlice,
  conversationAgentSessionsSlice,
  currentIdsSlice,
  documentsSlice,
  documentTagsSlice,
  evaluationReportsSlice,
  evaluationsSlice,
  extractionAgentSessionsSlice,
  formAgentSessionsSlice,
  projectAnalyticsSlice,
  projectMembershipsSlice,
  projectsSlice,
  reviewCampaignsReportsSlice,
  reviewCampaignsSlice,
]

export const { injectSlices: injectStudioSlices, resetSlices: resetStudioSlices } =
  createSliceManager({
    middlewares: studioMiddlewareList,
    slices: studioSliceList,
  })

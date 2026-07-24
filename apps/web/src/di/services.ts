import type { IBackofficeSpi } from "@/backoffice/features/backoffice/backoffice.spi"
import type { IConversationAgentSessionsSpi } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.spi"
import type { IExtractionAgentSessionsSpi } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.spi"
import type { IAgentSessionMessagesSpi } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.spi"
import type { IAgentsSpi } from "@/common/features/agents/agents.spi"
import type { IAgentCsvExtractionRunsSpi } from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.spi"
import type { IMeSpi } from "@/common/features/me/me.spi"
import type { IOrganizationsSpi } from "@/common/features/organizations/organizations.spi"
import type { IProjectsSpi } from "@/common/features/projects/projects.spi"
import type { IEvaluationConversationDatasetsSpi } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.spi"
import type { IEvaluationConversationRunsSpi } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.spi"
import type { IEvaluationExtractionDatasetsSpi } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.spi"
import type { IEvaluationExtractionRunsSpi } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.spi"
import { services } from "@/external/axios.services"
import type { IReviewerSpi } from "@/reviewer/features/review-campaigns/reviewer.spi"
import type { IAgentEmbedConfigsSpi } from "@/studio/features/agent-embed-configs/agent-embed-configs.spi"
import type { IAgentMembershipsSpi } from "@/studio/features/agent-memberships/agent-memberships.spi"
import type { IAgentMessageFeedbackSpi } from "@/studio/features/agent-message-feedback/agent-message-feedback.spi"
import type { IAgentSubAgentsSpi } from "@/studio/features/agent-sub-agents/agent-sub-agents.spi"
import type { IAgentAnalyticsSpi } from "@/studio/features/analytics/agent/agent-analytics.spi"
import type { IProjectAnalyticsSpi } from "@/studio/features/analytics/project/analytics.spi"
import type { IDocumentTagsSpi } from "@/studio/features/document-tags/document-tags.spi"
import type { IDocumentsSpi } from "@/studio/features/documents/documents.spi"
import type { IInvitationsSpi } from "@/studio/features/invitations/invitations.spi"
import type { IMcpServersSpi } from "@/studio/features/mcp-servers/mcp-servers.spi"
import type { IProjectMembershipsSpi } from "@/studio/features/project-memberships/project-memberships.spi"
import type { IResourceLibrariesSpi } from "@/studio/features/resource-libraries/resource-libraries.spi"
import type { IReportsSpi } from "@/studio/features/review-campaigns/reports/reports.spi"
import type { IReviewCampaignsSpi } from "@/studio/features/review-campaigns/review-campaigns.spi"
import type { ITesterSpi } from "@/tester/features/review-campaigns/tester.spi"

export type Services = {
  agentAnalytics: IAgentAnalyticsSpi
  agentCsvExtractionRuns: IAgentCsvExtractionRunsSpi
  agentEmbedConfigs: IAgentEmbedConfigsSpi
  agentMemberships: IAgentMembershipsSpi
  agentMessageFeedback: IAgentMessageFeedbackSpi
  agentSubAgents: IAgentSubAgentsSpi
  agents: IAgentsSpi
  agentSessionMessages: IAgentSessionMessagesSpi
  backoffice: IBackofficeSpi
  conversationAgentSessions: IConversationAgentSessionsSpi
  documents: IDocumentsSpi
  documentTags: IDocumentTagsSpi
  evaluationConversationDatasets: IEvaluationConversationDatasetsSpi
  evaluationConversationRuns: IEvaluationConversationRunsSpi
  evaluationExtractionDatasets: IEvaluationExtractionDatasetsSpi
  evaluationExtractionRuns: IEvaluationExtractionRunsSpi
  extractionAgentSessions: IExtractionAgentSessionsSpi
  invitations: IInvitationsSpi
  mcpServers: IMcpServersSpi
  me: IMeSpi
  organizations: IOrganizationsSpi
  projectAnalytics: IProjectAnalyticsSpi
  projectMemberships: IProjectMembershipsSpi
  projects: IProjectsSpi
  resourceLibraries: IResourceLibrariesSpi
  reviewCampaigns: IReviewCampaignsSpi
  reviewCampaignsReports: IReportsSpi
  reviewCampaignsReviewer: IReviewerSpi
  reviewCampaignsTester: ITesterSpi
}

export const getServices = (): Services => {
  // TODO: if .env.STORRYBOOK => mockSerivces
  // if(envProd) require("@/external/axios") // ensure axios singleton is initialized
  // else require("@/mocks") // ensure axios singleton is initialized
  return services
}

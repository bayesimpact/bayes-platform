import backoffice from "@/backoffice/features/backoffice/external/backoffice.api"
import agentMemories from "@/common/features/agents/agent-memories/external/agent-memories.api"
import conversationAgentSessions from "@/common/features/agents/agent-sessions/conversation/external/conversation-agent-sessions.api"
import extractionAgentSessions from "@/common/features/agents/agent-sessions/extraction/external/extraction-agent-sessions.api"
import agentSessionMessages from "@/common/features/agents/agent-sessions/shared/agent-session-messages/external/agent-session-messages.api"
import agentSettings from "@/common/features/agents/agent-settings/external/agent-settings.api"
import agentCsvExtractionRuns from "@/common/features/agents/csv-extraction-runs/external/agent-csv-extraction-runs.api"
import agents from "@/common/features/agents/external/agents.api"
import me from "@/common/features/me/external/me.api"
import oauthConsent from "@/common/features/oauth-consent/external/oauth-consent.api"
import oauthGrants from "@/common/features/oauth-grants/external/oauth-grants.api"
import organizations from "@/common/features/organizations/external/organizations.api"
import projects from "@/common/features/projects/external/projects.api"
import agentEmbedConfigs from "@/studio/features/agent-embed-configs/external/agent-embed-configs.api"
import agentMemberships from "@/studio/features/agent-memberships/external/agent-memberships.api"
import agentMessageFeedback from "@/studio/features/agent-message-feedback/external/agent-message-feedback.api"
import agentSubAgents from "@/studio/features/agent-sub-agents/external/agent-sub-agents.api"
import agentAnalytics from "@/studio/features/analytics/agent/external/agent-analytics.api"
import projectAnalytics from "@/studio/features/analytics/project/external/analytics.api"
import appCatalog from "@/studio/features/app-catalog/external/app-catalog.api"
import appInstallations from "@/studio/features/app-installations/external/app-installations.api"
import conversationReview from "@/studio/features/conversation-review/external/conversation-review.api"
import documentSources from "@/studio/features/document-sources/external/document-sources.api"
import documentTags from "@/studio/features/document-tags/external/document-tags.api"
import documents from "@/studio/features/documents/external/documents.api"
import evaluationConversationDatasets from "@/studio/features/evaluation-conversation-datasets/external/evaluation-conversation-datasets.api"
import invitations from "@/studio/features/invitations/external/invitations.api"
import mcpServers from "@/studio/features/mcp-servers/external/mcp-servers.api"
import projectEmbeddingModels from "@/studio/features/project-embedding-models/external/project-embedding-models.api"
import projectMemberships from "@/studio/features/project-memberships/external/project-memberships.api"
import resourceLibraries from "@/studio/features/resource-libraries/external/resource-libraries.api"
import testCases from "@/studio/features/test-cases/external/test-cases.api"

export const services = {
  agentAnalytics,
  agentCsvExtractionRuns,
  agentEmbedConfigs,
  agentMemberships,
  agentMemories,
  agentMessageFeedback,
  agentSubAgents,
  agents,
  agentSettings,
  agentSessionMessages,
  backoffice,
  conversationAgentSessions,
  conversationReview,
  documentSources,
  documents,
  documentTags,
  evaluationConversationDatasets,
  extractionAgentSessions,
  mcpServers,
  appCatalog,
  appInstallations,
  me,
  oauthConsent,
  oauthGrants,
  invitations,
  organizations,
  projectAnalytics,
  projectEmbeddingModels,
  projectMemberships,
  projects,
  resourceLibraries,
  testCases,
}

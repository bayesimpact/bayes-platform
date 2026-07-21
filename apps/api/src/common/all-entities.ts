// Registering all entities in one place is convenient because it makes TypeORM metadata
// deterministic across app variants (API, workers, tests) and avoids
// "hidden"  runtime failures from missing relation targets.

import { Activity } from "@/domains/activities/activity.entity"
import { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { AgentCsvExtractionRun } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run.entity"
import { AgentCsvExtractionRunRecord } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run-record.entity"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { ProjectAgentSessionCategory } from "@/domains/agents/session-categories/project-agent-session-category.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { AgentMessageAttachmentDocument } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.entity"
import { AgentMessageFeedback } from "@/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.entity"
import { AgentSubAgent } from "@/domains/agents/sub-agents/agent-sub-agent.entity"
import { Document } from "@/domains/documents/document.entity"
import { DocumentChunk } from "@/domains/documents/embeddings/document-chunk.entity"
import { DocumentChunkEmbedding } from "@/domains/documents/embeddings/document-chunk-embedding.entity"
import { DocumentParentChunk } from "@/domains/documents/embeddings/document-parent-chunk.entity"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { EvaluationConversationDataset } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.entity"
import { EvaluationConversationDatasetRecord } from "@/domains/evaluations/conversation/datasets/records/evaluation-conversation-dataset-record.entity"
import { EvaluationConversationRun } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run.entity"
import { EvaluationConversationRunRecord } from "@/domains/evaluations/conversation/runs/records/evaluation-conversation-run-record.entity"
import { EvaluationExtractionDataset } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetDocument } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.entity"
import { EvaluationExtractionDatasetRecord } from "@/domains/evaluations/extraction/datasets/records/evaluation-extraction-dataset-record.entity"
import { EvaluationExtractionRun } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run.entity"
import { EvaluationExtractionRunRecord } from "@/domains/evaluations/extraction/runs/records/evaluation-extraction-run-record.entity"
import { FeatureFlag } from "@/domains/feature-flags/feature-flag.entity"
import { Invitation } from "@/domains/invitations/invitation.entity"
import { AgentMcpServer } from "@/domains/mcp-servers/agent-mcp-server.entity"
import { McpServer } from "@/domains/mcp-servers/mcp-server.entity"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { Project } from "@/domains/projects/project.entity"
import { AgentEmbedConfig } from "@/domains/public-chat/agent-embed-configs/agent-embed-config.entity"
import { PublicAgentSession } from "@/domains/public-chat/public-agent-sessions/public-agent-session.entity"
import { ResourceLibrary } from "@/domains/resource-libraries/resource-library.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { ReviewerSessionReview } from "@/domains/review-campaigns/reviewer-session-reviews/reviewer-session-review.entity"
import { TesterCampaignSurvey } from "@/domains/review-campaigns/tester-campaign-surveys/tester-campaign-survey.entity"
import { TesterSessionFeedback } from "@/domains/review-campaigns/tester-session-feedbacks/tester-session-feedback.entity"
import { TermsAcceptance } from "@/domains/terms-compliance/terms-acceptance.entity"
import { TermsDocument } from "@/domains/terms-compliance/terms-document.entity"
import { User } from "@/domains/users/user.entity"
import { AgentSettings } from "../domains/agents/settings/agent-settings.entity"

export const ALL_ENTITIES = [
  Activity,
  Agent,
  AgentSettings,
  AgentSessionCategory,
  ProjectAgentSessionCategory,
  AgentMcpServer,
  AgentMessage,
  AgentMessageAttachmentDocument,
  AgentMessageFeedback,
  AgentSubAgent,
  AgentCsvExtractionRun,
  AgentCsvExtractionRunRecord,
  ConversationAgentSession,
  ConversationAgentSessionCategory,
  Document,
  DocumentChunk,
  DocumentChunkEmbedding,
  DocumentParentChunk,
  DocumentTag,
  EvaluationConversationDataset,
  EvaluationConversationDatasetRecord,
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetRecord,
  EvaluationExtractionDatasetDocument,
  EvaluationExtractionRun,
  EvaluationExtractionRunRecord,
  ExtractionAgentSession,
  FeatureFlag,
  FormAgentSession,
  Invitation,
  McpServer,
  Organization,
  UserMembership,
  Project,
  AgentEmbedConfig,
  PublicAgentSession,
  ResourceLibrary,
  ReviewCampaign,
  ReviewerSessionReview,
  TermsAcceptance,
  TermsDocument,
  TesterCampaignSurvey,
  TesterSessionFeedback,
  User,
]

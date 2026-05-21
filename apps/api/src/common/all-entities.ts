// Registering all entities in one place is convenient because it makes TypeORM metadata
// deterministic across app variants (API, workers, tests) and avoids
// "hidden"  runtime failures from missing relation targets.

import { Activity } from "@/domains/activities/activity.entity"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentCategory } from "@/domains/agents/categories/agent-category.entity"
import { ProjectAgentCategory } from "@/domains/agents/categories/project-agent-category.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { AgentMessageAttachmentDocument } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.entity"
import { AgentMessageFeedback } from "@/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.entity"
import { Document } from "@/domains/documents/document.entity"
import { DocumentChunk } from "@/domains/documents/embeddings/document-chunk.entity"
import { DocumentChunkEmbedding } from "@/domains/documents/embeddings/document-chunk-embedding.entity"
import { DocumentParentChunk } from "@/domains/documents/embeddings/document-parent-chunk.entity"
import { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import { Evaluation } from "@/domains/evaluations/evaluation.entity"
import { EvaluationExtractionDataset } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetDocument } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.entity"
import { EvaluationExtractionDatasetRecord } from "@/domains/evaluations/extraction/datasets/records/evaluation-extraction-dataset-record.entity"
import { EvaluationExtractionRun } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run.entity"
import { EvaluationExtractionRunRecord } from "@/domains/evaluations/extraction/runs/records/evaluation-extraction-run-record.entity"
import { EvaluationReport } from "@/domains/evaluations/reports/evaluation-report.entity"
import { FeatureFlag } from "@/domains/feature-flags/feature-flag.entity"
import { Invitation } from "@/domains/invitations/invitation.entity"
import { AgentMcpServer } from "@/domains/mcp-servers/agent-mcp-server.entity"
import { McpServer } from "@/domains/mcp-servers/mcp-server.entity"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { ReviewCampaignMembership } from "@/domains/review-campaigns/memberships/review-campaign-membership.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { ReviewerSessionReview } from "@/domains/review-campaigns/reviewer-session-reviews/reviewer-session-review.entity"
import { TesterCampaignSurvey } from "@/domains/review-campaigns/tester-campaign-surveys/tester-campaign-survey.entity"
import { TesterSessionFeedback } from "@/domains/review-campaigns/tester-session-feedbacks/tester-session-feedback.entity"
import { TermsAcceptance } from "@/domains/terms-compliance/terms-acceptance.entity"
import { TermsDocument } from "@/domains/terms-compliance/terms-document.entity"
import { User } from "@/domains/users/user.entity"

export const ALL_ENTITIES = [
  Activity,
  Agent,
  AgentCategory,
  ProjectAgentCategory,
  AgentMcpServer,
  AgentMembership,
  AgentMessage,
  AgentMessageAttachmentDocument,
  AgentMessageFeedback,
  ConversationAgentSession,
  ConversationAgentSessionCategory,
  Document,
  DocumentChunk,
  DocumentChunkEmbedding,
  DocumentParentChunk,
  DocumentTag,
  Evaluation,
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetRecord,
  EvaluationExtractionDatasetDocument,
  EvaluationReport,
  EvaluationExtractionRun,
  EvaluationExtractionRunRecord,
  ExtractionAgentSession,
  FeatureFlag,
  FormAgentSession,
  Invitation,
  McpServer,
  Organization,
  OrganizationMembership,
  Project,
  ProjectMembership,
  ReviewCampaign,
  ReviewCampaignMembership,
  ReviewerSessionReview,
  TermsAcceptance,
  TermsDocument,
  TesterCampaignSurvey,
  TesterSessionFeedback,
  User,
]

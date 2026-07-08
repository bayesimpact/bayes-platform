import type { ObjectLiteral, Repository } from "typeorm"
import { Activity } from "@/domains/activities/activity.entity"
import { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { AgentCsvExtractionRun } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run.entity"
import { AgentCsvExtractionRunRecord } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run-record.entity"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { ProjectAgentSessionCategory } from "@/domains/agents/session-categories/project-agent-session-category.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { AgentMessageAttachmentDocument } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.entity"
import { AgentMessageFeedback } from "@/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.entity"
import { AgentSubAgent } from "@/domains/agents/sub-agents/agent-sub-agent.entity"
import { Document } from "@/domains/documents/document.entity"
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
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { AgentEmbedConfig } from "@/domains/public-chat/agent-embed-configs/agent-embed-config.entity"
import { PublicAgentSession } from "@/domains/public-chat/public-agent-sessions/public-agent-session.entity"
import { ResourceLibrary } from "@/domains/resource-libraries/resource-library.entity"
import { ReviewCampaignMembership } from "@/domains/review-campaigns/memberships/review-campaign-membership.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { ReviewerSessionReview } from "@/domains/review-campaigns/reviewer-session-reviews/reviewer-session-review.entity"
import { TesterCampaignSurvey } from "@/domains/review-campaigns/tester-campaign-surveys/tester-campaign-survey.entity"
import { TesterSessionFeedback } from "@/domains/review-campaigns/tester-session-feedbacks/tester-session-feedback.entity"
import { TermsAcceptance } from "@/domains/terms-compliance/terms-acceptance.entity"
import { TermsDocument } from "@/domains/terms-compliance/terms-document.entity"
import { User } from "@/domains/users/user.entity"
import { AgentSettings } from "../../domains/agents/settings/agent-settings.entity"

export type AllRepositories = {
  agentEmbedConfigRepository: Repository<AgentEmbedConfig>
  activityRepository: Repository<Activity>
  agentSessionCategoryRepository: Repository<AgentSessionCategory>
  agentMcpServerRepository: Repository<AgentMcpServer>
  agentMembershipRepository: Repository<AgentMembership>
  agentMessageAttachmentDocumentRepository: Repository<AgentMessageAttachmentDocument>
  agentMessageFeedbackRepository: Repository<AgentMessageFeedback>
  agentMessageRepository: Repository<AgentMessage>
  agentRepository: Repository<Agent>
  agentSettingsRepository: Repository<AgentSettings>
  agentSubAgentRepository: Repository<AgentSubAgent>
  conversationAgentSessionRepository: Repository<ConversationAgentSession>
  conversationAgentSessionCategoryRepository: Repository<ConversationAgentSessionCategory>
  agentCsvExtractionRunRepository: Repository<AgentCsvExtractionRun>
  agentCsvExtractionRunRecordRepository: Repository<AgentCsvExtractionRunRecord>
  documentRepository: Repository<Document>
  evaluationExtractionDatasetDocumentRepository: Repository<EvaluationExtractionDatasetDocument>
  evaluationExtractionDatasetRecordRepository: Repository<EvaluationExtractionDatasetRecord>
  evaluationExtractionDatasetRepository: Repository<EvaluationExtractionDataset>
  evaluationExtractionRunRecordRepository: Repository<EvaluationExtractionRunRecord>
  evaluationExtractionRunRepository: Repository<EvaluationExtractionRun>
  evaluationReportRepository: Repository<EvaluationReport>
  evaluationRepository: Repository<Evaluation>
  extractionAgentSessionRepository: Repository<ExtractionAgentSession>
  featureFlagRepository: Repository<FeatureFlag>
  formAgentSessionRepository: Repository<FormAgentSession>
  invitationRepository: Repository<Invitation>
  mcpServerRepository: Repository<McpServer>
  organizationMembershipRepository: Repository<OrganizationMembership>
  organizationRepository: Repository<Organization>
  projectMembershipRepository: Repository<ProjectMembership>
  projectAgentSessionCategoryRepository: Repository<ProjectAgentSessionCategory>
  projectRepository: Repository<Project>
  publicAgentSessionRepository: Repository<PublicAgentSession>
  resourceLibraryRepository: Repository<ResourceLibrary>
  reviewCampaignMembershipRepository: Repository<ReviewCampaignMembership>
  reviewCampaignRepository: Repository<ReviewCampaign>
  reviewerSessionReviewRepository: Repository<ReviewerSessionReview>
  termsAcceptanceRepository: Repository<TermsAcceptance>
  termsDocumentRepository: Repository<TermsDocument>
  testerCampaignSurveyRepository: Repository<TesterCampaignSurvey>
  testerSessionFeedbackRepository: Repository<TesterSessionFeedback>
  userMembershipRepository: Repository<UserMembership>
  userRepository: Repository<User>
}

export function buildAllRepositories(
  getRepository: <T extends ObjectLiteral>(entity: new () => T) => Repository<T>,
): AllRepositories {
  return {
    agentEmbedConfigRepository: getRepository(AgentEmbedConfig),
    activityRepository: getRepository(Activity),
    agentSessionCategoryRepository: getRepository(AgentSessionCategory),
    agentMcpServerRepository: getRepository(AgentMcpServer),
    agentMembershipRepository: getRepository(AgentMembership),
    agentMessageAttachmentDocumentRepository: getRepository(AgentMessageAttachmentDocument),
    agentMessageFeedbackRepository: getRepository(AgentMessageFeedback),
    agentMessageRepository: getRepository(AgentMessage),
    agentRepository: getRepository(Agent),
    agentSettingsRepository: getRepository(AgentSettings),
    agentSubAgentRepository: getRepository(AgentSubAgent),
    conversationAgentSessionRepository: getRepository(ConversationAgentSession),
    conversationAgentSessionCategoryRepository: getRepository(ConversationAgentSessionCategory),
    agentCsvExtractionRunRepository: getRepository(AgentCsvExtractionRun),
    agentCsvExtractionRunRecordRepository: getRepository(AgentCsvExtractionRunRecord),
    documentRepository: getRepository(Document),
    evaluationExtractionDatasetDocumentRepository: getRepository(
      EvaluationExtractionDatasetDocument,
    ),
    evaluationExtractionDatasetRecordRepository: getRepository(EvaluationExtractionDatasetRecord),
    evaluationExtractionDatasetRepository: getRepository(EvaluationExtractionDataset),
    evaluationExtractionRunRecordRepository: getRepository(EvaluationExtractionRunRecord),
    evaluationExtractionRunRepository: getRepository(EvaluationExtractionRun),
    evaluationReportRepository: getRepository(EvaluationReport),
    evaluationRepository: getRepository(Evaluation),
    extractionAgentSessionRepository: getRepository(ExtractionAgentSession),
    featureFlagRepository: getRepository(FeatureFlag),
    formAgentSessionRepository: getRepository(FormAgentSession),
    invitationRepository: getRepository(Invitation),
    mcpServerRepository: getRepository(McpServer),
    organizationMembershipRepository: getRepository(OrganizationMembership),
    organizationRepository: getRepository(Organization),
    projectMembershipRepository: getRepository(ProjectMembership),
    projectAgentSessionCategoryRepository: getRepository(ProjectAgentSessionCategory),
    projectRepository: getRepository(Project),
    publicAgentSessionRepository: getRepository(PublicAgentSession),
    resourceLibraryRepository: getRepository(ResourceLibrary),
    reviewCampaignMembershipRepository: getRepository(ReviewCampaignMembership),
    reviewCampaignRepository: getRepository(ReviewCampaign),
    reviewerSessionReviewRepository: getRepository(ReviewerSessionReview),
    termsAcceptanceRepository: getRepository(TermsAcceptance),
    termsDocumentRepository: getRepository(TermsDocument),
    testerCampaignSurveyRepository: getRepository(TesterCampaignSurvey),
    testerSessionFeedbackRepository: getRepository(TesterSessionFeedback),
    userMembershipRepository: getRepository(UserMembership),
    userRepository: getRepository(User),
  }
}

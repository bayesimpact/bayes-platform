import type { Agent } from "@/domains/agents/agent.entity"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { AgentCsvExtractionRun } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run.entity"
import type { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import type { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import type { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import type { Document } from "@/domains/documents/document.entity"
import type { DocumentTag } from "@/domains/documents/tags/document-tag.entity"
import type { Evaluation } from "@/domains/evaluations/evaluation.entity"
import type { EvaluationExtractionDataset } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.entity"
import type { EvaluationExtractionRun } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run.entity"
import type { EvaluationReport } from "@/domains/evaluations/reports/evaluation-report.entity"
import type { Invitation } from "@/domains/invitations/invitation.entity"
import type { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import type { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { ResourceLibrary } from "@/domains/resource-libraries/resource-library.entity"
import type { ReviewCampaignMembership } from "@/domains/review-campaigns/memberships/review-campaign-membership.entity"
import type { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { ReviewCampaignAgentType } from "@/domains/review-campaigns/review-campaigns.types"
import type { User } from "@/domains/users/user.entity"

export interface JwtPayload {
  sub: string
  iss: string
  aud: string[]
  iat: number
  exp: number
  azp: string
  scope: string
}

export interface EndpointRequest {
  jwtPayload: JwtPayload
  user: User
}

export interface EndpointRequestWithOrganizationMembership extends EndpointRequest {
  organizationMembership: OrganizationMembership
  organizationId: string
}

export interface EndpointRequestWithProject extends EndpointRequestWithOrganizationMembership {
  project: Project
  projectMembership: ProjectMembership | undefined
}

export interface EndpointRequestWithProjectMembership extends EndpointRequestWithProject {
  memberProjectMembership: ProjectMembership
}

export interface EndpointRequestWithAgent extends EndpointRequestWithProject {
  agent: Agent
  agentMembership: AgentMembership | undefined
}

export interface EndpointRequestWithAgentMembership extends EndpointRequestWithAgent {
  memberAgentMembership: AgentMembership
}

export interface EndpointRequestWithDocument extends EndpointRequestWithProject {
  document: Document
}

export interface EndpointRequestWithDocumentTag extends EndpointRequestWithProject {
  documentTag: DocumentTag
}

export interface EndpointRequestWithResourceLibrary extends EndpointRequestWithProject {
  resourceLibrary: ResourceLibrary
}

export interface EndpointRequestWithAgentSession<
  T extends ConversationAgentSession | FormAgentSession | ExtractionAgentSession,
> extends EndpointRequestWithAgent {
  agentSession: T
}

export interface EndpointRequestWithEvaluationExtractionDataset extends EndpointRequestWithProject {
  evaluationExtractionDataset: EvaluationExtractionDataset
}

export interface EndpointRequestWithEvaluation extends EndpointRequestWithProject {
  evaluation: Evaluation
}

export interface EndpointRequestWithEvaluationReport extends EndpointRequestWithEvaluation {
  evaluationReport: EvaluationReport
}

export interface EndpointRequestWithEvaluationExtractionRun extends EndpointRequestWithProject {
  evaluationExtractionRun: EvaluationExtractionRun
}

export interface EndpointRequestWithAgentCsvExtractionRun extends EndpointRequestWithProject {
  agentCsvExtractionRun: AgentCsvExtractionRun
}

export interface EndpointRequestWithReviewCampaign extends EndpointRequestWithProject {
  reviewCampaign: ReviewCampaign
}

export interface EndpointRequestWithReviewCampaignMembership
  extends EndpointRequestWithReviewCampaign {
  testerMembership: ReviewCampaignMembership | undefined
  reviewerMembership: ReviewCampaignMembership | undefined
}

export interface EndpointRequestWithAgentSessionInCampaign extends EndpointRequestWithProject {
  reviewCampaign: ReviewCampaign
  agentSessionInCampaign: {
    sessionId: string
    agentType: ReviewCampaignAgentType
    userId: string
  }
}

export interface EndpointRequestWithInvitationScope extends EndpointRequestWithProject {
  /** Set for revokeOne — the pending invitation being acted on. */
  invitation?: Invitation
  /** The target entity (Project, Agent, or ReviewCampaign) loaded by the resolver. */
  invitationTarget?: Project | Agent | ReviewCampaign
  /** Caller's agent membership, set only when targetType is "agent". */
  invitationAgentMembership?: AgentMembership
}

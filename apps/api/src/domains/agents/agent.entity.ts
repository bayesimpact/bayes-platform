import type {
  AgentLocale,
  AgentModel,
  AgentTemperature,
  AgentType,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
import { Column, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { AgentCategory } from "@/domains/agents/categories/agent-category.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { Project } from "@/domains/projects/project.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { DocumentTag } from "../documents/tags/document-tag.entity"
import { EvaluationReport } from "../evaluations/reports/evaluation-report.entity"
import { AgentMcpServer } from "../mcp-servers/agent-mcp-server.entity"
import { ExtractionAgentSession } from "./extraction-agent-sessions/extraction-agent-session.entity"
import { AgentMembership } from "./memberships/agent-membership.entity"

@ConnectEntity("agent")
export class Agent extends ConnectEntityBase {
  @ManyToOne(
    () => Project,
    (project) => project.agents,
  )
  @JoinColumn({ name: "project_id" })
  project!: Project

  @Column({ type: "varchar" })
  name!: string

  @Column({ type: "text", name: "default_prompt" })
  defaultPrompt!: string

  @Column({ type: "varchar" })
  model!: AgentModel

  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
  temperature!: AgentTemperature

  @Column({ type: "varchar" })
  locale!: AgentLocale

  @Column({ type: "varchar", default: "conversation" })
  type!: AgentType

  @Column({ type: "varchar", name: "documents_rag_mode", default: "all" })
  documentsRagMode!: DocumentsRagMode

  @Column({ type: "text", nullable: true, name: "instruction_prompt" })
  instructionPrompt!: string | null

  @Column({ type: "text", nullable: true, name: "greeting_message" })
  greetingMessage!: string | null

  @Column({ type: "jsonb", nullable: true, name: "output_json_schema" })
  outputJsonSchema!: Record<string, unknown> | null

  @OneToMany(
    () => ConversationAgentSession,
    (conversationAgentSession) => conversationAgentSession.agent,
  )
  conversationAgentSessions!: ConversationAgentSession[]

  @OneToMany(
    () => EvaluationReport,
    (evaluationReport) => evaluationReport.agent,
  )
  evaluationReports!: EvaluationReport[]

  @OneToMany(
    () => ExtractionAgentSession,
    (extractionAgentSession) => extractionAgentSession.agent,
  )
  extractionSessions!: ExtractionAgentSession[]

  @ManyToMany("DocumentTag", (tag: DocumentTag) => tag.agents)
  @JoinTable({
    name: "agent_document_tag",
    joinColumn: { name: "agent_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "document_tag_id", referencedColumnName: "id" },
  })
  documentTags!: DocumentTag[]

  @OneToMany(
    () => AgentMembership,
    (agentMembership) => agentMembership.agent,
  )
  agentMemberships!: AgentMembership[]

  @OneToMany(
    () => AgentMcpServer,
    (agentMcpServer) => agentMcpServer.agent,
  )
  agentMcpServers!: AgentMcpServer[]

  @OneToMany(
    () => ReviewCampaign,
    (reviewCampaign) => reviewCampaign.agent,
  )
  reviewCampaigns!: ReviewCampaign[]

  @OneToMany(
    () => AgentCategory,
    (agentCategory) => agentCategory.agent,
  )
  categories!: AgentCategory[]
}

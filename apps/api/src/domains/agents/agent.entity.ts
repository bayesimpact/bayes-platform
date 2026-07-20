import type { AgentType } from "@caseai-connect/api-contracts"
import { Column, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { Project } from "@/domains/projects/project.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { DocumentTag } from "../documents/tags/document-tag.entity"
import { EvaluationReport } from "../evaluations/reports/evaluation-report.entity"
import { AgentMcpServer } from "../mcp-servers/agent-mcp-server.entity"
import { ResourceLibrary } from "../resource-libraries/resource-library.entity"

type AgentSubAgentRelation = {
  parentAgent: Agent
  childAgent: Agent
}

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

  @Column({ type: "varchar", default: "conversation" })
  type!: AgentType

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

  @ManyToMany("DocumentTag", (tag: DocumentTag) => tag.agents)
  @JoinTable({
    name: "agent_document_tag",
    joinColumn: { name: "agent_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "document_tag_id", referencedColumnName: "id" },
  })
  documentTags!: DocumentTag[]

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
    () => AgentSessionCategory,
    (agentSessionCategory) => agentSessionCategory.agent,
  )
  sessionCategories!: AgentSessionCategory[]

  @OneToMany("AgentSubAgent", (agentSubAgent: AgentSubAgentRelation) => agentSubAgent.parentAgent)
  childSubAgents!: AgentSubAgentRelation[]

  @OneToMany("AgentSubAgent", (agentSubAgent: AgentSubAgentRelation) => agentSubAgent.childAgent)
  parentSubAgents!: AgentSubAgentRelation[]

  @ManyToMany(
    () => ResourceLibrary,
    (resourceLibrary) => resourceLibrary.agents,
  )
  @JoinTable({
    name: "agent_resource_library",
    joinColumn: { name: "agent_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "resource_library_id", referencedColumnName: "id" },
  })
  resourceLibraries!: ResourceLibrary[]
}

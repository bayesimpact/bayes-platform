import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Agent } from "@/domains/agents/agent.entity"

@Entity("public_agent_session")
@Index(["sessionTokenHash"])
export class PublicAgentSession extends Base4AllEntity {
  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @Column({ type: "uuid", name: "organization_id" })
  organizationId!: string

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "varchar", name: "session_token_hash", unique: true })
  sessionTokenHash!: string

  @Column({ type: "varchar", name: "external_visitor_id", nullable: true })
  externalVisitorId!: string | null

  @Column({ type: "timestamp", name: "last_activity_at", nullable: true })
  lastActivityAt!: Date | null

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent
}

import { Column, JoinColumn, ManyToOne, OneToMany, OneToOne, type Relation } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { Document } from "@/domains/documents/document.entity"
import { ConversationAgentSession } from "../../conversation-agent-sessions/conversation-agent-session.entity"
import { AgentMessageAttachmentDocument } from "./agent-message-attachment-document.entity"
import { AgentMessageFeedback } from "./feedback/agent-message-feedback.entity"

export type MessageStatus = "streaming" | "completed" | "aborted" | "error"

/** Persisted MCP App pointer. Live HTML is hydrated onto the API DTO at read time. */
export type AgentMessageMcpApp = {
  mcpServerId: string
  resourceUri: string
}

export type AgentMessageToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  mcpApp?: AgentMessageMcpApp
}

@ConnectEntity("agent_message", "sessionId", "createdAt")
export class AgentMessage extends ConnectEntityBase {
  @Column({ type: "uuid", name: "session_id" })
  sessionId!: string

  @Column({ type: "uuid", name: "agent_settings_id", nullable: false })
  agentSettingsId!: string
  @ManyToOne("AgentSettings", (agentSettings: AgentSettings) => agentSettings.id, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_settings_id" })
  agentSettings!: AgentSettings

  @Column({ type: "varchar" })
  role!: "user" | "assistant" | "tool"

  @Column({ type: "text" })
  content!: string

  @Column({ type: "varchar", nullable: true })
  status!: MessageStatus | null

  @Column({ type: "timestamp", nullable: true, name: "started_at" })
  startedAt!: Date | null

  @Column({ type: "timestamp", nullable: true, name: "completed_at" })
  completedAt!: Date | null

  @Column({ type: "jsonb", nullable: true, name: "tool_calls" })
  toolCalls!: AgentMessageToolCall[] | null

  @ManyToOne(
    () => ConversationAgentSession,
    (session) => session.messages,
    { onDelete: "CASCADE", nullable: true, createForeignKeyConstraints: false },
  )
  @JoinColumn({ name: "session_id" })
  conversationAgentSession?: Relation<ConversationAgentSession>

  session(agentType: string): ConversationAgentSession | undefined {
    switch (agentType) {
      case "conversation":
        return this.conversationAgentSession
      default:
        return undefined
    }
  }

  @Column({ type: "uuid", name: "document_id", nullable: true })
  documentId!: string | null
  @OneToOne(() => Document, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "document_id" })
  document!: Document | null

  @Column({ type: "uuid", name: "attachment_document_id", nullable: true })
  attachmentDocumentId!: string | null
  @OneToOne(() => AgentMessageAttachmentDocument, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "attachment_document_id" })
  attachmentDocument!: AgentMessageAttachmentDocument | null

  @OneToMany(
    () => AgentMessageFeedback,
    (agentMessageFeedback) => agentMessageFeedback.agentMessage,
  )
  agentMessageFeedbacks!: AgentMessageFeedback[]
}

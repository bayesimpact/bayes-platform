import type {
  AgentMemoryOrigin,
  AgentMemorySessionTypeDto,
  AgentMemoryStatus,
} from "@caseai-connect/api-contracts"
import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"
import { User } from "@/domains/users/user.entity"

/**
 * One fact a conversation agent remembers about one user (see ADR 0023).
 *
 * Memory belongs to the pair (agent, user) and to the kind of session it was
 * learned in: playground tests never feed what the agent knows in live
 * conversations. A fact the agent inferred on an agent in `ask` mode starts as
 * a `pending` proposal and only reaches the prompt once the user saves it.
 *
 * The source session column has no foreign key: memory outlives the
 * conversation retention purge on purpose.
 */
@ConnectEntity("agent_memory", "agentId", "userId", "sessionType")
export class AgentMemory extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string
  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent?: Agent

  @Column({ type: "uuid", name: "user_id" })
  userId!: string
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User

  @Column({ type: "varchar", name: "session_type" })
  sessionType!: AgentMemorySessionTypeDto

  @Column({ type: "text" })
  content!: string

  @Column({ type: "varchar" })
  origin!: AgentMemoryOrigin

  @Column({ type: "varchar" })
  status!: AgentMemoryStatus

  @Column({ type: "uuid", name: "source_session_id", nullable: true })
  sourceSessionId!: string | null
}

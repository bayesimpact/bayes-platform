import { Column, Entity, JoinColumn, ManyToOne, type Relation, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Agent } from "@/domains/agents/agent.entity"
import { McpServer } from "./mcp-server.entity"

@Entity("agent_mcp_server")
@Unique(["agentId", "mcpServerId"])
export class AgentMcpServer extends Base4AllEntity {
  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @Column({ type: "uuid", name: "mcp_server_id" })
  mcpServerId!: string

  @Column({ type: "boolean", default: true })
  enabled!: boolean

  @ManyToOne(
    () => Agent,
    (agent) => agent.agentMcpServers,
  )
  @JoinColumn({ name: "agent_id" })
  agent!: Relation<Agent>

  @ManyToOne(
    () => McpServer,
    (mcpServer) => mcpServer.agentMcpServers,
  )
  @JoinColumn({ name: "mcp_server_id" })
  mcpServer!: Relation<McpServer>
}

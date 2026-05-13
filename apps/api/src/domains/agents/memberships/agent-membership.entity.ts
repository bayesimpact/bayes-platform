import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { User } from "@/domains/users/user.entity"
import { Agent } from "../agent.entity"

export type AgentMembershipRole = "owner" | "admin" | "member"

@Entity("agent_membership")
@Unique(["agentId", "userId"])
export class AgentMembership extends Base4AllEntity {
  @Column({ type: "uuid", name: "agent_id" })
  agentId!: string

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @Column({ type: "varchar", name: "invitation_token", unique: true })
  invitationToken!: string

  @Column({ type: "varchar" })
  role!: AgentMembershipRole

  @ManyToOne(
    () => Agent,
    (agent) => agent.agentMemberships,
  )
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @ManyToOne(
    () => User,
    (user) => user.agentMemberships,
  )
  @JoinColumn({ name: "user_id" })
  user!: User
}

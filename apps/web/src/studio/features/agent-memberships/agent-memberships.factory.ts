import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"
import { SAMPLE_AGENT_ROLES } from "@/studio/features/project-memberships/project-memberships.factory"
import type { AgentMembership } from "./agent-memberships.models"

type AgentMembershipTransientParams = {
  agent: Agent
  /** The member's one role, when `roles` is not given. Member by default. */
  role: LegacyMembershipRole
}

class AgentMembershipFactory extends Factory<AgentMembership, AgentMembershipTransientParams> {}

export const agentMembershipFactory = AgentMembershipFactory.define(
  ({ params, transientParams }) => {
    const { agent, role = "member" } = transientParams
    if (!agent) {
      throw new Error("Agent must be provided in transient params to build an AgentMembership")
    }
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const agentRole = SAMPLE_AGENT_ROLES.find(({ key }) => key === `agent_${role}`)
    return {
      agentId: agent.id,
      userId: params.userId ?? faker.string.uuid(),
      userName: params.userName ?? `${firstName} ${lastName}`,
      userEmail: params.userEmail ?? faker.internet.email({ firstName, lastName }).toLowerCase(),
      userHasSignedIn: params.userHasSignedIn ?? true,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      roles:
        (params.roles as AgentMembership["roles"] | undefined) ?? (agentRole ? [agentRole] : []),
    } satisfies AgentMembership
  },
)

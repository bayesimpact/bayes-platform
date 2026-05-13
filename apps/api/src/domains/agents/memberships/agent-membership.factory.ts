import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Repository } from "typeorm"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import type { Agent } from "../agent.entity"
import type { AgentMembership, AgentMembershipRole } from "./agent-membership.entity"
import { PLACEHOLDER_AUTH0_ID_PREFIX } from "./agent-memberships.service"

type AgentMembershipTransientParams = {
  agent: Agent
  user: User
}

class AgentMembershipFactory extends Factory<AgentMembership, AgentMembershipTransientParams> {
  member() {
    return this.params({ role: "member" })
  }

  admin() {
    return this.params({ role: "admin" })
  }

  owner() {
    return this.params({ role: "owner" })
  }
}

export const agentMembershipFactory = AgentMembershipFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.agent) {
      throw new Error("agent transient is required")
    }
    if (!transientParams.user) {
      throw new Error("user transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      agentId: transientParams.agent.id,
      userId: transientParams.user.id,
      invitationToken: params.invitationToken || randomUUID(),
      role: (params.role || "member") as AgentMembershipRole,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
      agent: transientParams.agent,
      user: transientParams.user,
    } satisfies AgentMembership
  },
)

export const addUserToAgent = async ({
  repositories,
  agent,
  user,
  membership,
}: {
  repositories: {
    userRepository: Repository<User>
    agentMembershipRepository: Repository<AgentMembership>
  }
  agent: Agent
  user?: User
  membership?: Partial<AgentMembership>
}) => {
  const createMembership = async (user: User) => {
    const newMembership = await repositories.agentMembershipRepository.save(
      agentMembershipFactory.transient({ agent, user }).build(membership),
    )
    return { membership: newMembership, user }
  }

  if (user) return await createMembership(user)

  const newUser = await repositories.userRepository.save(userFactory.build(user))
  return await createMembership(newUser)
}

export const inviteUserToAgent = async ({
  repositories,
  agent,
  user,
}: {
  repositories: AllRepositories
  agent: Agent
  user?: Partial<User>
}) => {
  user = user ?? {
    email: "invited@example.com",
    name: "Invited User",
    auth0Id: `${PLACEHOLDER_AUTH0_ID_PREFIX}-test`,
  }
  const invitedUser = userFactory.build(user)
  await repositories.userRepository.save(invitedUser)

  const membership = agentMembershipFactory.transient({ agent, user: invitedUser }).build()
  await repositories.agentMembershipRepository.save(membership)

  return { membership, invitedUser }
}

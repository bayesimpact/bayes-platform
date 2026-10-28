import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { saveUserMembershipRows } from "@/domains/memberships/user-membership.factory"
import { AGENT_ROLES } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import type { Agent } from "../agent.entity"
import type { AgentMembershipFixture, AgentRoleKey } from "./agent-membership.types"

type AgentMembershipTransientParams = {
  agent: Agent
  user: User
}

class AgentMembershipFactory extends Factory<
  AgentMembershipFixture,
  AgentMembershipTransientParams
> {
  withRoles(...roleKeys: AgentRoleKey[]) {
    return this.params({ roleKeys })
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
      roleKeys: (params.roleKeys as AgentRoleKey[] | undefined) ?? [AGENT_ROLES.member],
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
      agent: transientParams.agent,
      user: transientParams.user,
    } satisfies AgentMembershipFixture
  },
)

/**
 * Saves an agent membership to `user_membership`, one row per role key.
 */
export const saveAgentMembership = async ({
  repositories,
  membership,
}: {
  repositories: AllRepositories
  membership: AgentMembershipFixture
}) => {
  const [saved] = await saveUserMembershipRows({
    repositories,
    id: membership.id,
    userId: membership.userId,
    resourceType: "agent",
    resourceId: membership.agentId,
    roleKeys: membership.roleKeys,
  })
  return { ...membership, id: saved?.id ?? membership.id }
}

export const addUserToAgent = async ({
  repositories,
  agent,
  user,
  membership,
}: {
  repositories: AllRepositories
  agent: Agent
  user?: User
  membership?: Partial<AgentMembershipFixture>
}) => {
  const createMembership = async (user: User) => {
    const newMembership = await saveAgentMembership({
      repositories,
      membership: agentMembershipFactory.transient({ agent, user }).build(membership),
    })
    return { membership: newMembership, user }
  }

  if (user) return await createMembership(user)

  const newUser = await repositories.userRepository.save(userFactory.build(user))
  return await createMembership(newUser)
}

export const addMemberByEmailToAgent = async ({
  repositories,
  agent,
  user,
}: {
  repositories: AllRepositories
  agent: Agent
  user?: Partial<User>
}) => {
  user = user ?? {
    email: "added@example.com",
    name: "Added User",
    authSubject: null,
  }
  const addedUser = userFactory.build(user)
  await repositories.userRepository.save(addedUser)

  const membership = await saveAgentMembership({
    repositories,
    membership: agentMembershipFactory.transient({ agent, user: addedUser }).build(),
  })

  return { membership, addedUser }
}

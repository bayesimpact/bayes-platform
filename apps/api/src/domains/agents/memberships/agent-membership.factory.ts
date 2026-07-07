import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import type { Agent } from "../agent.entity"
import type { AgentMembershipFixture, AgentMembershipRole } from "./agent-membership.types"
import { PLACEHOLDER_AUTH0_ID_PREFIX } from "./agent-memberships.service"

type AgentMembershipTransientParams = {
  agent: Agent
  user: User
}

class AgentMembershipFactory extends Factory<
  AgentMembershipFixture,
  AgentMembershipTransientParams
> {
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
      role: (params.role || "member") as AgentMembershipRole,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
      agent: transientParams.agent,
      user: transientParams.user,
    } satisfies AgentMembershipFixture
  },
)

/**
 * Saves an agent membership to `user_membership`.
 */
export const saveAgentMembership = async ({
  repositories,
  membership,
}: {
  repositories: AllRepositories
  membership: AgentMembershipFixture
}) => {
  const saved = await repositories.userMembershipRepository.save(
    userMembershipFactory.build({
      id: membership.id,
      userId: membership.userId,
      resourceType: "agent",
      resourceId: membership.agentId,
      role: membership.role,
    }),
  )
  return { ...membership, id: saved.id }
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

  const invitationToken = randomUUID()
  const membership = await saveAgentMembership({
    repositories,
    membership: agentMembershipFactory.transient({ agent, user: invitedUser }).build(),
  })

  return { membership, invitedUser, invitationToken }
}

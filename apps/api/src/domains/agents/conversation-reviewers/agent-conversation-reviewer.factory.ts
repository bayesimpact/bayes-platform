import type { AllRepositories } from "@/common/test/test-transaction-manager"
import type { Agent } from "@/domains/agents/agent.entity"
import { roleGrantFactory } from "@/domains/memberships/role-grant.factory"
import { AGENT_CONVERSATION_REVIEWER_ROLE } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"

/** Grants `agent_conversation_reviewer` on `agent` to `user`, as the backoffice does. */
export async function grantConversationReview({
  repositories,
  user,
  agent,
}: {
  repositories: AllRepositories
  user: User
  agent: Agent
}): Promise<void> {
  const role = await repositories.roleRepository.findOneOrFail({
    where: { key: AGENT_CONVERSATION_REVIEWER_ROLE },
  })
  await repositories.roleGrantRepository.save(
    roleGrantFactory.build({
      userId: user.id,
      resourceType: "agent",
      resourceId: agent.id,
      roleId: role.id,
    }),
  )
}

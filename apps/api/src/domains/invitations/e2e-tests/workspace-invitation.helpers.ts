import type { AllRepositories } from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"

/**
 * A workspace with two agents, owned by the caller, who owns both agents too: a workspace owner
 * holds a role on every agent, as when the agents are created in the app.
 */
export async function createWorkspaceWithTwoAgents(
  repositories: AllRepositories,
  authSubject: string,
) {
  const context = await createOrganizationWithAgent(repositories, {
    user: { authSubject },
    agent: { name: "Helpful Assistant" },
  })
  const secondAgent = await repositories.agentRepository.save(
    agentFactory
      .transient({ organization: context.organization, project: context.project })
      .build({ name: "Scheduling Bot" }),
  )
  await addUserToAgent({
    repositories,
    agent: secondAgent,
    user: context.user,
    membership: { roleKeys: ["agent_owner"] },
  })
  return { ...context, firstAgent: context.agent, secondAgent }
}

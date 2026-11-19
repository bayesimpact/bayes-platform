import type { AgentTypeDto } from "@caseai-connect/eval-contracts"
import type { EvaluationWorkspace } from "./evaluation-agents"
import { flattenEvaluationAgents } from "./evaluation-agents"
import type { MyCampaign } from "./my-campaigns"

/**
 * An agent the person reaches only through the campaigns they test or review: it belongs to no
 * project they evaluate or manage. Choosing it opens its first campaign.
 */
export type CampaignAgent = {
  id: string
  name: string
  type: AgentTypeDto
  /** The campaign the switcher opens, the first of the agent's in the person's list. */
  campaign: MyCampaign
}

/** The agents of the person's campaigns that no project of theirs holds, in the campaigns' order. */
export function campaignAgentsOf(workspace: EvaluationWorkspace): CampaignAgent[] {
  const projectAgentIds = new Set(
    flattenEvaluationAgents(workspace.groups).map((agent) => agent.id),
  )
  const agentsById = new Map<string, CampaignAgent>()
  for (const campaign of workspace.myCampaigns) {
    // A campaign the API sends without its agent cannot name it: the switcher leaves it out.
    if (!campaign.agent || projectAgentIds.has(campaign.agentId)) continue
    if (agentsById.has(campaign.agentId)) continue
    agentsById.set(campaign.agentId, {
      id: campaign.agentId,
      name: campaign.agent.name,
      type: campaign.agent.type,
      campaign,
    })
  }
  return [...agentsById.values()]
}

/** How many agents the switcher lists: those of the person's projects, then of their campaigns. */
export const switchableAgentCountOf = (workspace: EvaluationWorkspace): number =>
  flattenEvaluationAgents(workspace.groups).length + campaignAgentsOf(workspace).length

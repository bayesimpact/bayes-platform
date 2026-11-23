import { canEvaluate, type EvaluationAgent } from "@/features/agents"
import { hasCampaignPages } from "@/features/campaigns"

/**
 * A part of the app an agent opens for a person, each one a feature with pages of its own: the
 * evaluations of the agent, for who evaluates it, and its review campaigns, for who manages them.
 */
export type AgentSection = "evaluations" | "campaigns"

/** The first page of each section. */
export const AGENT_SECTION_ROUTES = {
  evaluations: "/o/$organizationId/p/$projectId/a/$agentId/evaluations",
  campaigns: "/o/$organizationId/p/$projectId/a/$agentId/review-campaigns",
} as const satisfies Record<AgentSection, string>

/**
 * The sections an agent opens for the person, in the sidebar's order. One section is the whole
 * app for that agent; several make the agent's first page a hub.
 */
export function agentSectionsOf(agent: EvaluationAgent): AgentSection[] {
  const sections: AgentSection[] = []
  if (canEvaluate(agent)) sections.push("evaluations")
  if (hasCampaignPages(agent)) sections.push("campaigns")
  return sections
}

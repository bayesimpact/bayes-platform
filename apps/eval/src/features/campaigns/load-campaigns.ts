import type {
  AgentParamsDto,
  ProjectParamsDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION } from "@caseai-connect/eval-contracts"
import { loaderStaleTime } from "@caseai-connect/frontend-lib"
import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import {
  agentVersionsQueryOptions,
  type EvaluationAgent,
  hasProjectPermission,
} from "@/features/agents"
import { orNotFound } from "@/lib/not-found"
import { campaignQueryOptions, projectCampaignsQueryOptions } from "./api/queries"

/** Whether the person sees the review campaigns of an agent's project. */
function canSeeCampaigns(agent: EvaluationAgent): boolean {
  return hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION)
}

/**
 * Whether an agent has campaign pages for this person: they see its project's campaigns, and it
 * is a conversation agent, since a campaign reviews conversations.
 */
export function hasCampaignPages(agent: EvaluationAgent): boolean {
  return canSeeCampaigns(agent) && agent.type === "conversation"
}

/** The campaign pages of an agent are not found for a person the agent has none for. */
export function requireCampaignAgent(agent: EvaluationAgent): void {
  if (!hasCampaignPages(agent)) throw notFound()
}

/**
 * Starts reading the campaigns of an agent's project for the sidebar, which must not hold the page
 * back: nothing waits for it.
 */
export function prefetchCampaigns(
  queryClient: QueryClient,
  agent: EvaluationAgent,
  project: ProjectParamsDto,
): void {
  if (!hasCampaignPages(agent)) return
  void queryClient.prefetchQuery({
    ...projectCampaignsQueryOptions(project),
    staleTime: loaderStaleTime,
  })
}

/** Loads the campaigns of a project, for the list of one of its agents. */
export async function loadCampaigns(queryClient: QueryClient, project: ProjectParamsDto) {
  await orNotFound(() =>
    queryClient.query({ ...projectCampaignsQueryOptions(project), staleTime: loaderStaleTime }),
  )
}

/** Loads the saved versions of an agent, which a new campaign chooses from. */
export async function loadNewCampaign(queryClient: QueryClient, agent: AgentParamsDto) {
  await orNotFound(() =>
    queryClient.query({ ...agentVersionsQueryOptions(agent), staleTime: loaderStaleTime }),
  )
}

/** Loads a campaign, which is not found when it belongs to another agent. */
export async function loadCampaign(
  queryClient: QueryClient,
  campaign: ReviewCampaignParamsDto,
  agent: EvaluationAgent,
) {
  const detail = await orNotFound(() =>
    queryClient.query({ ...campaignQueryOptions(campaign), staleTime: loaderStaleTime }),
  )
  if (detail.agentId !== agent.id) throw notFound()
}

/**
 * Loads a campaign's editor: the campaign, with the saved versions of its agent, which its setup
 * chooses from and names.
 */
export async function loadCampaignSetup(
  queryClient: QueryClient,
  campaign: ReviewCampaignParamsDto,
  agent: EvaluationAgent,
) {
  const agentParams = {
    organizationId: campaign.organizationId,
    projectId: campaign.projectId,
    agentId: agent.id,
  }
  await Promise.all([
    loadCampaign(queryClient, campaign, agent),
    orNotFound(() =>
      queryClient.query({ ...agentVersionsQueryOptions(agentParams), staleTime: loaderStaleTime }),
    ),
  ])
}

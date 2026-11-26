import { loaderStaleTime } from "@caseai-connect/frontend-lib"
import type { QueryClient } from "@tanstack/react-query"
import { evaluationWorkspaceQueryOptions } from "./api/queries"
import type { EvaluationWorkspace } from "./evaluation-agents"

/** Loads, for a route's `beforeLoad` or loader, what the person can evaluate, which stays cached. */
export function loadEvaluationWorkspace(queryClient: QueryClient): Promise<EvaluationWorkspace> {
  return queryClient.query({ ...evaluationWorkspaceQueryOptions(), staleTime: loaderStaleTime })
}

/** Loads what the person holds again, after they joined a project, an agent or a campaign. */
export function refreshEvaluationWorkspace(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: evaluationWorkspaceQueryOptions().queryKey })
}

/**
 * Loads what the person holds again after a manager changed a campaign they take part in: its
 * name, its status, its deletion or one of their roles, which their campaign menus show. A
 * campaign they take no part in, such as a draft, leaves the workspace as it is.
 */
export async function refreshCampaignInWorkspace(
  queryClient: QueryClient,
  reviewCampaignId: string,
): Promise<void> {
  const workspace = queryClient.getQueryData(evaluationWorkspaceQueryOptions().queryKey)
  if (!workspace?.myCampaigns.some((campaign) => campaign.id === reviewCampaignId)) return
  await refreshEvaluationWorkspace(queryClient)
}

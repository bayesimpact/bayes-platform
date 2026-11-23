import type { ReviewCampaignStatusDto } from "@caseai-connect/eval-contracts"

/** The order of the sidebar: what is under way first, then what is prepared, then what is over. */
const STATUS_RANKS = {
  active: 0,
  draft: 1,
  closed: 2,
} as const satisfies Record<ReviewCampaignStatusDto, number>

/**
 * The campaigns of an agent among its project's, as the sidebar lists them: the active ones, the
 * drafts, then the closed ones, each group in the order of the API.
 */
export function sidebarCampaignsOf<
  TCampaign extends { agentId: string; status: ReviewCampaignStatusDto },
>(projectCampaigns: TCampaign[], agentId: string): TCampaign[] {
  return (
    projectCampaigns
      .filter((campaign) => campaign.agentId === agentId)
      // `filter` made a new array, which `sort` may order in place; the sort is stable.
      .sort((first, second) => STATUS_RANKS[first.status] - STATUS_RANKS[second.status])
  )
}

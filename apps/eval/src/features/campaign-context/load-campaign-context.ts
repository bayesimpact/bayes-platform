import type {
  CampaignContextOutputDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { loaderStaleTime } from "@caseai-connect/frontend-lib"
import type { QueryClient } from "@tanstack/react-query"
import { orNotFound } from "@/lib/not-found"
import { campaignContextQueryOptions } from "./api/queries"

/** Loads a campaign for one of its participants: a campaign that is not theirs is not found. */
export function loadCampaignContext(
  queryClient: QueryClient,
  campaign: ReviewCampaignParamsDto,
): Promise<CampaignContextOutputDto> {
  return orNotFound(() =>
    queryClient.query({ ...campaignContextQueryOptions(campaign), staleTime: loaderStaleTime }),
  )
}

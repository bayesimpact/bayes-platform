import type {
  CampaignContextOutputDto,
  ReviewCampaignParamsDto,
} from "@bayes-platform/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { orNotFound } from "@/lib/not-found"
import { loaderStaleTime } from "@/lib/start-query"
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

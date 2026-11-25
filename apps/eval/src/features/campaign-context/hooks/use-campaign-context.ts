import type {
  CampaignContextOutputDto,
  ReviewCampaignParamsDto,
} from "@bayes-platform/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { campaignContextQueryOptions } from "../api/queries"

/** The campaign of the page, from the query `loadCampaignContext` started. */
export function useCampaignContext(campaign: ReviewCampaignParamsDto): CampaignContextOutputDto {
  return useSuspenseQuery(campaignContextQueryOptions(campaign)).data
}

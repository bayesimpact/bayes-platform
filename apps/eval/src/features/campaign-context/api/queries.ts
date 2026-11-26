import {
  EvalReviewCampaignsRoutes,
  type ReviewCampaignParamsDto,
} from "@bayes-platform/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { campaignContextKeys } from "./keys"

/** A campaign as its testers and reviewers see it: its agent and its testers' questions. */
export const campaignContextQueryOptions = (campaign: ReviewCampaignParamsDto) =>
  queryOptions({
    queryKey: campaignContextKeys.detail(campaign),
    queryFn: ({ signal }) =>
      apiRequest(EvalReviewCampaignsRoutes.getContext, { params: campaign, signal }),
  })

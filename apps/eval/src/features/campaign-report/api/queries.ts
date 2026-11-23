import {
  EvalReviewCampaignsRoutes,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { campaignReportKeys } from "./keys"

/** The report of a campaign: its figures, how the answers spread, and its sessions. */
export const campaignReportQueryOptions = (campaign: ReviewCampaignParamsDto) =>
  queryOptions({
    queryKey: campaignReportKeys.detail(campaign),
    queryFn: ({ signal }) =>
      apiRequest(EvalReviewCampaignsRoutes.getReport, { params: campaign, signal }),
  })

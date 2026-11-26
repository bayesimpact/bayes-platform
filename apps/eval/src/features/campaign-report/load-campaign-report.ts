import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { loaderStaleTime } from "@caseai-connect/frontend-lib"
import type { QueryClient } from "@tanstack/react-query"
import { orNotFound } from "@/lib/not-found"
import { campaignReportQueryOptions } from "./api/queries"

/** Loads a campaign's report, not found for a person who may not read it. */
export async function loadCampaignReport(
  queryClient: QueryClient,
  campaign: ReviewCampaignParamsDto,
) {
  await orNotFound(() =>
    queryClient.query({ ...campaignReportQueryOptions(campaign), staleTime: loaderStaleTime }),
  )
}

import type {
  CampaignSessionParamsDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { loaderStaleTime } from "@caseai-connect/frontend-lib"
import type { QueryClient } from "@tanstack/react-query"
import { orNotFound } from "@/lib/not-found"
import { reviewerSessionQueryOptions, reviewerSessionsQueryOptions } from "./api/queries"

/** Loads the sessions a reviewer can review in a campaign. */
export async function loadReviewerSessions(
  queryClient: QueryClient,
  campaign: ReviewCampaignParamsDto,
) {
  await orNotFound(() =>
    queryClient.query({ ...reviewerSessionsQueryOptions(campaign), staleTime: loaderStaleTime }),
  )
}

/** Loads a session for a reviewer: one that is not in the campaign is not found. */
export async function loadReviewerSession(
  queryClient: QueryClient,
  session: CampaignSessionParamsDto,
) {
  await orNotFound(() =>
    queryClient.query({ ...reviewerSessionQueryOptions(session), staleTime: loaderStaleTime }),
  )
}

import {
  type CampaignSessionParamsDto,
  EvalReviewerRoutes,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { campaignReviewKeys } from "./keys"

/** The sessions the testers of a campaign started, newest first. */
export const reviewerSessionsQueryOptions = (campaign: ReviewCampaignParamsDto) =>
  queryOptions({
    queryKey: campaignReviewKeys.sessions(campaign),
    queryFn: async ({ signal }) => {
      const { sessions } = await apiRequest(EvalReviewerRoutes.getSessions, {
        params: campaign,
        signal,
      })
      return sessions
    },
  })

/**
 * A session as a reviewer sees it: blind before their own review, whole once they submitted.
 */
export const reviewerSessionQueryOptions = (session: CampaignSessionParamsDto) =>
  queryOptions({
    queryKey: campaignReviewKeys.session(session),
    queryFn: ({ signal }) => apiRequest(EvalReviewerRoutes.getSession, { params: session, signal }),
  })

import {
  type CampaignSessionParamsDto,
  EvalReviewerRoutes,
  type RatedFeedbackInputDto,
} from "@bayes-platform/eval-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { campaignReviewKeys } from "./keys"

/**
 * Sends a reviewer's review of a session: a first one, or the change of the one they gave. The
 * session then shows whole, and the list counts the review.
 */
export function useSaveReview(session: CampaignSessionParamsDto, reviewId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RatedFeedbackInputDto) =>
      reviewId === null
        ? apiRequest(EvalReviewerRoutes.createReview, { params: session, body })
        : apiRequest(EvalReviewerRoutes.updateReview, {
            params: { ...session, reviewId },
            body,
          }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: campaignReviewKeys.session(session) }),
        queryClient.invalidateQueries({ queryKey: campaignReviewKeys.sessions(session) }),
      ]),
  })
}

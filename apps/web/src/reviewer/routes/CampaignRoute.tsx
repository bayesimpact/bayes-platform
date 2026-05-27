import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { selectTesterContext } from "@/tester/features/review-campaigns/tester.selectors"
import { reviewCampaignsReviewerActions } from "../features/review-campaigns/reviewer.slice"

export function CampaignRoute({ children }: { children: React.ReactNode }) {
  const reviewCampaignId = useAppSelector(selectCurrentReviewCampaignId)
  const testerContext = useAppSelector(selectTesterContext)

  useMount({
    actions: {
      mount: reviewCampaignsReviewerActions.campaignMount,
      unmount: reviewCampaignsReviewerActions.campaignUnmount,
    },
    condition: !!reviewCampaignId,
  })

  if (!reviewCampaignId) return <LoadingRoute />
  return <AsyncRoute data={[testerContext]}>{children}</AsyncRoute>
}

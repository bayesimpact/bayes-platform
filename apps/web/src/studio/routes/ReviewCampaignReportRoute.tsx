import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { CampaignReportPage } from "@/studio/features/review-campaigns/reports/components/CampaignReportPage"
import { reviewCampaignsReportsActions } from "@/studio/features/review-campaigns/reports/reports.slice"

export function ReviewCampaignReportRoute() {
  const projectRoute = useGetProjectRoute()
  // On a navigation inside the studio, StudioRoute sets the campaign id after this route mounts.
  const reviewCampaignId = useAppSelector(selectCurrentReviewCampaignId)

  useMount({
    actions: reviewCampaignsReportsActions,
    condition: !!reviewCampaignId,
    refreshOn: [reviewCampaignId],
  })

  if (!reviewCampaignId) return <LoadingRoute />
  return <CampaignReportPage backPath={projectRoute} />
}

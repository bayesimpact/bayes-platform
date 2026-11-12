import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId } from "@/common/hooks/use-value"
import { CampaignReportPage } from "@/studio/features/review-campaigns/reports/components/CampaignReportPage"
import { reviewCampaignsReportsActions } from "@/studio/features/review-campaigns/reports/reports.slice"
import { ReviewerRoutes } from "./helpers"

export function ReviewerReportRoute() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)
  useMount({ actions: reviewCampaignsReportsActions })
  return (
    <CampaignReportPage
      backPath={ReviewerRoutes.campaign.build({ organizationId, projectId, reviewCampaignId })}
    />
  )
}

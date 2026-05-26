import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { CampaignReportPage } from "@/studio/features/review-campaigns/reports/components/CampaignReportPage"
import { ReviewerRoutes } from "./helpers"

export function ReviewerReportRoute() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)
  return (
    <CampaignReportPage
      backPath={ReviewerRoutes.campaign.build({ organizationId, projectId, reviewCampaignId })}
    />
  )
}

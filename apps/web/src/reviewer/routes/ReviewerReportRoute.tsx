import { useParams } from "react-router-dom"
import { CampaignReportPage } from "@/studio/features/review-campaigns/reports/components/CampaignReportPage"
import { ReviewerRoutes } from "./helpers"

type Params = {
  organizationId: string
  projectId: string
  reviewCampaignId: string
}

export function ReviewerReportRoute() {
  const params = useParams<Params>() as Params

  return (
    <CampaignReportPage
      backPath={ReviewerRoutes.campaign.build(params)}
      organizationId={params.organizationId}
      projectId={params.projectId}
      reviewCampaignId={params.reviewCampaignId}
    />
  )
}

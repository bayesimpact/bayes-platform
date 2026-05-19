import { useParams } from "react-router-dom"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { CampaignReportPage } from "@/studio/features/review-campaigns/reports/components/CampaignReportPage"

type Params = {
  organizationId: string
  projectId: string
  reviewCampaignId: string
}

export function ReviewCampaignReportRoute() {
  const getProjectRoute = useGetProjectRoute()
  const params = useParams<Params>()
  if (!params.organizationId || !params.projectId || !params.reviewCampaignId) return null

  return (
    <CampaignReportPage
      backPath={getProjectRoute()}
      organizationId={params.organizationId}
      projectId={params.projectId}
      reviewCampaignId={params.reviewCampaignId}
    />
  )
}

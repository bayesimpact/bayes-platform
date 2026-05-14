import { useParams } from "react-router-dom"
import { CampaignReportPage } from "@/studio/features/review-campaigns/reports/components/CampaignReportPage"
import { buildReviewCampaignsPath } from "./helpers"

type Params = {
  organizationId: string
  projectId: string
  reviewCampaignId: string
}
// FIXME:
// const { getPath } = useGetPath()
// const handleBack = () => {
//   const path = getPath("project")
//   navigate(path)
// }
export function ReviewCampaignReportRoute() {
  const params = useParams<Params>()
  if (!params.organizationId || !params.projectId || !params.reviewCampaignId) return null
  const backPath = buildReviewCampaignsPath({
    organizationId: params.organizationId,
    projectId: params.projectId,
  })
  return (
    <CampaignReportPage
      backPath={backPath}
      organizationId={params.organizationId}
      projectId={params.projectId}
      reviewCampaignId={params.reviewCampaignId}
    />
  )
}

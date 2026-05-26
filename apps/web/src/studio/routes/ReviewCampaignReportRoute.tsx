import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { CampaignReportPage } from "@/studio/features/review-campaigns/reports/components/CampaignReportPage"

export function ReviewCampaignReportRoute() {
  const projectRoute = useGetProjectRoute()
  return <CampaignReportPage backPath={projectRoute} />
}

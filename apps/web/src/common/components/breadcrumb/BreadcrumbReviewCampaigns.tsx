import { BreadcrumbItem } from "@caseai-connect/ui/shad/breadcrumb"
import { useTranslation } from "react-i18next"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbReviewCampaigns() {
  const { isRoute } = useIsRoute()
  const isReviewCampaignsRoute = isRoute(StudioRoutes.reviewCampaigns.path)
  const { t } = useTranslation("reviewCampaigns")
  if (!isReviewCampaignsRoute) return null
  return <BreadcrumbItem>{t("reviewCampaigns")}</BreadcrumbItem>
}

import { BreadcrumbItem } from "@caseai-connect/ui/shad/breadcrumb"
import { useTranslation } from "react-i18next"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbProjectAnalytics() {
  const { hasFeature } = useFeatureFlags()
  const { isRoute } = useIsRoute()
  const isProjectAnalyticsRoute = isRoute(StudioRoutes.projectAnalytics.path)
  const { t } = useTranslation()
  if (!hasFeature("project-analytics") || !isProjectAnalyticsRoute) return null
  return <BreadcrumbItem className="capitalize">{t("analytics:analytics")}</BreadcrumbItem>
}

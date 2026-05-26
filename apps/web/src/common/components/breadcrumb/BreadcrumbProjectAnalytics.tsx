import { BreadcrumbItem } from "@caseai-connect/ui/shad/breadcrumb"
import { useTranslation } from "react-i18next"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { useValue } from "@/common/hooks/use-value"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbProjectAnalytics() {
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const { isRoute } = useIsRoute()
  const isProjectAnalyticsRoute = isRoute(StudioRoutes.projectAnalytics.path)
  const { t } = useTranslation()
  if (!hasFeature("project-analytics") || !isProjectAnalyticsRoute) return null
  return <BreadcrumbItem className="capitalize">{t("analytics:analytics")}</BreadcrumbItem>
}

import { BreadcrumbItem, BreadcrumbSeparator } from "@caseai-connect/ui/shad/breadcrumb"
import { GitCommitHorizontalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { useValue } from "@/common/hooks/use-value"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbAgentAnalytics() {
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const { isRoute } = useIsRoute()
  const isAgentAnalyticsRoute = isRoute(StudioRoutes.agentAnalytics.path)
  const { t } = useTranslation("agentAnalytics")
  if (!hasFeature("project-analytics") || !isAgentAnalyticsRoute) return null
  return (
    <>
      <BreadcrumbSeparator>
        <GitCommitHorizontalIcon />
      </BreadcrumbSeparator>
      <BreadcrumbItem className="capitalize">{t("list.pageTitle")}</BreadcrumbItem>
    </>
  )
}

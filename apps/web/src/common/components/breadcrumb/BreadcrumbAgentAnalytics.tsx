import { BreadcrumbItem, BreadcrumbSeparator } from "@caseai-connect/ui/shad/breadcrumb"
import { GitCommitHorizontalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbAgentAnalytics() {
  const { hasFeature } = useFeatureFlags()
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

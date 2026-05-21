import { BreadcrumbItem, BreadcrumbSeparator } from "@caseai-connect/ui/shad/breadcrumb"
import { GitCommitHorizontalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbAgentMembership() {
  const { isRoute } = useIsRoute()
  const isAgentMembershipsRoute = isRoute(StudioRoutes.agentMemberships.path)
  const { t } = useTranslation("projectMembership")
  if (!isAgentMembershipsRoute) return null
  return (
    <>
      <BreadcrumbSeparator>
        <GitCommitHorizontalIcon />
      </BreadcrumbSeparator>
      <BreadcrumbItem>{t("members")}</BreadcrumbItem>
    </>
  )
}

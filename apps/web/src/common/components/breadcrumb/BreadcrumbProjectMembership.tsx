import { BreadcrumbItem } from "@caseai-connect/ui/shad/breadcrumb"
import { useTranslation } from "react-i18next"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbProjectMembership() {
  const { isRoute } = useIsRoute()
  const isProjectMembershipsRoute = isRoute(StudioRoutes.projectMemberships.path)
  const { t } = useTranslation("projectMembership")
  if (!isProjectMembershipsRoute) return null
  return <BreadcrumbItem>{t("members")}</BreadcrumbItem>
}

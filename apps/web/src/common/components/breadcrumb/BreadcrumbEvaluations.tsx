import { BreadcrumbItem } from "@caseai-connect/ui/shad/breadcrumb"
import { useTranslation } from "react-i18next"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRouteNames } from "@/studio/routes/helpers"

export function BreadcrumbEvaluations() {
  const { isRoute } = useIsRoute()
  const isEvaluationRoute = isRoute(StudioRouteNames.EVALUATION)
  const { t } = useTranslation("evaluation")
  if (!isEvaluationRoute) return null
  return <BreadcrumbItem>{t("evaluation")}</BreadcrumbItem>
}

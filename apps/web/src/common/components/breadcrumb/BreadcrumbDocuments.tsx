import { BreadcrumbItem } from "@caseai-connect/ui/shad/breadcrumb"
import { useTranslation } from "react-i18next"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRouteNames } from "@/studio/routes/helpers"

export function BreadcrumbDocuments() {
  const { isRoute } = useIsRoute()
  const isDocumentsRoute = isRoute(StudioRouteNames.DOCUMENTS)
  const { t } = useTranslation("document")
  if (!isDocumentsRoute) return null
  return <BreadcrumbItem>{t("documents")}</BreadcrumbItem>
}

import { BreadcrumbItem, BreadcrumbSeparator } from "@caseai-connect/ui/shad/breadcrumb"
import { useTranslation } from "react-i18next"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbExternalSources() {
  const { isRoute } = useIsRoute()
  const isExternalSourcesRoute = isRoute(StudioRoutes.externalSources.path)
  const { t } = useTranslation()
  if (!isExternalSourcesRoute) return null
  return (
    <>
      <BreadcrumbItem>{t("document:sources")}</BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>{t("documentSource:title")}</BreadcrumbItem>
    </>
  )
}

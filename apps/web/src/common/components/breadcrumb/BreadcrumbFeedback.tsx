import { BreadcrumbItem, BreadcrumbSeparator } from "@caseai-connect/ui/shad/breadcrumb"
import { GitCommitHorizontalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useIsRoute } from "@/common/hooks/use-is-route"
import { StudioRoutes } from "@/studio/routes/helpers"

export function BreadcrumbFeedback() {
  const { isRoute } = useIsRoute()
  const isFeedbackRoute = isRoute(StudioRoutes.feedback.path)
  const { t } = useTranslation()
  if (!isFeedbackRoute) return null
  return (
    <>
      <BreadcrumbSeparator>
        <GitCommitHorizontalIcon />
      </BreadcrumbSeparator>
      <BreadcrumbItem>{t("agentMessageFeedback:feedback")}</BreadcrumbItem>
    </>
  )
}

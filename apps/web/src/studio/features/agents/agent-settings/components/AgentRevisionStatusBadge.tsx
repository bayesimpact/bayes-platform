import { Badge } from "@bayes-platform/ui/shad/badge"
import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"

/**
 * Where a revision stands: the draft being edited, the saved revision in production, or another
 * saved revision. Production and "the newest saved revision" are not the same thing, so the badge
 * says which one a revision is rather than only "published".
 */
export function AgentRevisionStatusBadge({
  version,
}: {
  version: Pick<AgentSettings, "isDraft" | "isProduction">
}) {
  const { t } = useTranslation()
  if (version.isDraft) return <Badge variant="warning">{t("status:draft")}</Badge>
  if (version.isProduction)
    return (
      <Badge variant="success">
        <ProductionDot />
        {t("agentSettings:production.badge")}
      </Badge>
    )
  return <Badge variant="secondary">{t("agentSettings:production.saved")}</Badge>
}

/** The green dot that marks the production revision wherever it shows. */
export function ProductionDot() {
  return <span aria-hidden className="size-2 shrink-0 rounded-full bg-green-600" />
}

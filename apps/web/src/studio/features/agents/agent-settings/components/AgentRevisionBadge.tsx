import { Badge } from "@bayes-platform/ui/shad/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@bayes-platform/ui/shad/tooltip"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { Agent } from "@/common/features/agents/agents.models"
import { buildDate } from "@/common/utils/build-date"
import { findVersion } from "../../../../../common/features/agents/agent-settings/agent-settings.functions"
import { ProductionDot } from "./AgentRevisionStatusBadge"
import { AgentSettingsHistorySheet } from "./AgentSettingsHistorySheet"

/**
 * Clickable `v{revision}` badge. Opens the version history sheet preselected on the
 * revision it labels. It says when that revision is the draft or the one in production. The
 * tooltip adds the revision name and date when the matching history entry is loaded.
 *
 * The sheet is controlled from here rather than through its `trigger` prop: a trigger
 * wrapped in a Radix `Tooltip` root would swallow the injected click handler (the
 * Tooltip root renders no DOM node and forwards no extra props).
 */
export function AgentRevisionBadge({
  agent,
  revision,
  versions,
  tooltipKey,
}: {
  agent: Agent
  revision: number
  versions: AgentSettings[]
  /** Which `agent:history.*` key describes what this revision means in context. */
  tooltipKey: "messageRevisionTooltip" | "headerRevisionTooltip" | "runRevisionTooltip"
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const version = findVersion(versions, revision)
  const isDraft = version?.isDraft ?? false
  const isProduction = version?.isProduction ?? false

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            asChild
            variant={isDraft ? "warning" : isProduction ? "success" : "secondary"}
            className="cursor-pointer hover:brightness-95"
            aria-label={t("agentSettings:history.revisionBadgeAria", { revision })}
          >
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              {isProduction ? (
                <>
                  <ProductionDot />
                  {t("agentSettings:autosave.productionVersion", { revision })}
                </>
              ) : (
                <>
                  {t("agentSettings:history.revisionBadge", { revision })}{" "}
                  {isDraft && `- ${t("agentSettings:history.draft")}`}
                </>
              )}
            </button>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <span className="block">{t(`agentSettings:history.${tooltipKey}`, { revision })}</span>
          {version?.name?.trim() && <span className="block font-medium">{version.name}</span>}
          {version && <span className="block">{buildDate(version.updatedAt)}</span>}
        </TooltipContent>
      </Tooltip>
      <AgentSettingsHistorySheet
        agent={agent}
        initialRevision={revision}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

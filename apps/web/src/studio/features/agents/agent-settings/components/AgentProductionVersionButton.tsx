import { Button } from "@caseai-connect/ui/shad/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { cn } from "@caseai-connect/ui/utils"
import { HistoryIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { selectAgentSettingsHistoryDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAbility } from "@/common/hooks/use-ability"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { ProductionDot } from "./AgentRevisionStatusBadge"
import { AgentSettingsHistorySheet } from "./AgentSettingsHistorySheet"

/**
 * Shows which saved revision is in production. For the agent's managers it opens the version
 * history on that revision, which is where the production revision is changed.
 *
 * The label comes from the agent itself, so everyone sees it. The history is only loaded for
 * managers: others get the label alone.
 */
export function AgentProductionVersionButton({ agent }: { agent: Agent }) {
  const { t } = useTranslation()
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })
  const historyData = useAppSelector(
    selectAgentSettingsHistoryDataByAgentId({ agentId: agent.id, includeDraft: true }),
  )
  const [open, setOpen] = useState(false)

  const production = agent.currentRevision
  if (!production) {
    return (
      <span className="inline-flex h-9 items-center rounded-md border border-dashed border-amber-400 px-3 text-sm font-medium text-amber-800">
        {t("agentSettings:production.none")}
      </span>
    )
  }

  const label = (
    <>
      <ProductionDot />
      {t("agentSettings:production.pill", { revision: production.number })}
      {production.name?.trim() && (
        <span className="hidden max-w-40 truncate font-normal text-green-800/80 sm:inline">
          {production.name}
        </span>
      )}
    </>
  )
  const pillClassName =
    "border-green-300 bg-green-50 text-green-900 hover:bg-green-100 hover:text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200"

  if (!canManageAgent || !ADS.isFulfilled(historyData)) {
    return (
      <span
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium",
          pillClassName,
        )}
      >
        {label}
      </span>
    )
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className={pillClassName}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            {label}
            <HistoryIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("agentSettings:production.openHistory")}</TooltipContent>
      </Tooltip>
      {/* Controlled rather than through the sheet's trigger: a Tooltip root would swallow the
          click handler the trigger injects. */}
      <AgentSettingsHistorySheet
        agent={agent}
        initialRevision={production.number}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

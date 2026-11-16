import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentProductionVersionButton } from "./AgentProductionVersionButton"

/**
 * The band under an agent page's header that says which saved version every live channel runs
 * with. Managers open the version history from it, where the version in production is changed.
 */
export function AgentProductionBar({ agent }: { agent: Agent }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/30 px-6 py-3">
      <AgentProductionVersionButton agent={agent} />
      <p className="text-sm text-muted-foreground">
        {agent.currentRevision
          ? t("agentSettings:production.description")
          : t("agentSettings:production.noneDescription")}
      </p>
    </div>
  )
}

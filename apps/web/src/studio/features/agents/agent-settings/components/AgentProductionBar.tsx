import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentProductionVersionButton } from "./AgentProductionVersionButton"

/**
 * The band that says what runs live, under the header of the agent page and of the editor: the
 * production revision. Managers open the version history from it, where they change it.
 *
 * Where the page shows an editor, pass its `agentSettings`: the band then says how the revision
 * on screen relates to production, since the editor shows the newest revision and the managers
 * may keep an older one live. Without it, the band says what production means.
 */
export function AgentProductionBar({
  agent,
  agentSettings,
}: {
  agent: Agent
  agentSettings?: AgentSettings
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/30 px-6 py-3">
      <AgentProductionVersionButton agent={agent} />
      <p className="text-sm text-muted-foreground">
        {!agent.currentRevision
          ? t("agentSettings:production.noneDescription")
          : agentSettings
            ? t(`agentSettings:production.editing.${buildEditingKey(agentSettings)}`, {
                revision: agentSettings.revision,
              })
            : t("agentSettings:production.description")}
      </p>
    </div>
  )
}

/** How the revision in the editor relates to production. */
function buildEditingKey(agentSettings: AgentSettings) {
  if (agentSettings.isDraft) return "draft"
  return agentSettings.isProduction ? "production" : "saved"
}

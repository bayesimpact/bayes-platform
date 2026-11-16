import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { HistoryIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentRevisionStatusBadge } from "./AgentRevisionStatusBadge"
import { AgentSettingsHistorySheet } from "./AgentSettingsHistorySheet"

/**
 * Entry point of the agent settings versioning UI in the editor: a trigger button showing
 * the revision being edited and where it stands, opening the version history sheet.
 *
 * The history itself is loaded by `StudioAgentRoute` for the whole agent subtree, so the
 * playground can label revisions too.
 */
export function AgentSettingsHistory({
  agent,
  agentSettings,
  buttonProps,
}: {
  agent: Agent
  agentSettings: AgentSettings
  buttonProps?: React.ComponentProps<typeof Button>
}) {
  const { t } = useTranslation()

  return (
    <AgentSettingsHistorySheet
      agent={agent}
      trigger={
        <Button type="button" size="lg" variant="outline" {...buttonProps}>
          <HistoryIcon className="size-4" />
          {t("agentSettings:history.button")}
          <Badge variant="secondary">v{agentSettings.revision}</Badge>
          <AgentRevisionStatusBadge version={agentSettings} />
        </Button>
      }
    />
  )
}

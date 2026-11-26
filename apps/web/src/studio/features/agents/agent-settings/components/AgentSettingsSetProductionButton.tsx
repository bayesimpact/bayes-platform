import { Button } from "@bayes-platform/ui/shad/button"
import { RocketIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useValue } from "@/common/hooks/use-value"
import { useCloseAgentSettingsHistory } from "./agent-settings-history-sheet-context"
import { SetProductionVersionDialog } from "./SetProductionVersionDialog"

/**
 * Puts the revision selected in the history in production. Offered on saved revisions only: the
 * draft must be saved first, and the production revision already is. Once it is done, the history
 * closes: the user is back on the page, which shows the new version in production.
 */
export function AgentSettingsSetProductionButton({ selected }: { selected: AgentSettings }) {
  const { t } = useTranslation()
  const agent = useValue(selectCurrentAgentData)
  const { abilities } = useAbility()
  const [pendingRevision, setPendingRevision] = useState<number | null>(null)
  const closeHistory = useCloseAgentSettingsHistory()

  if (!abilities.canManageAgent({ agentId: agent.id })) return null
  if (selected.isDraft || selected.isProduction) return null

  return (
    <>
      <Button size="sm" onClick={() => setPendingRevision(selected.revision)}>
        <RocketIcon className="size-4" />
        {t("agentSettings:production.set")}
      </Button>
      <SetProductionVersionDialog
        revision={pendingRevision}
        currentRevision={agent.currentRevision?.number}
        onClose={() => setPendingRevision(null)}
        onDone={closeHistory}
      />
    </>
  )
}

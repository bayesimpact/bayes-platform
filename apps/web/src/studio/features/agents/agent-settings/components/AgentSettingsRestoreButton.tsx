import { Button } from "@bayes-platform/ui/shad/button"
import { RotateCcwIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { restoreAgentSettings } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"

/** One-click restore: copies the selected revision's settings as a new (current) revision. */
export function AgentSettingsRestoreButton({
  revision,
  disabled,
}: {
  revision: number
  disabled: boolean
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const agent = useValue(selectCurrentAgentData)
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const handleConfirm = async () => {
    setIsRestoring(true)
    try {
      await dispatch(restoreAgentSettings({ revision })).unwrap()
    } catch {
      // The studio agents middleware shows the error notification.
    } finally {
      setIsRestoring(false)
      setConfirmOpen(false)
    }
  }

  if (!canManageAgent) return null
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || isRestoring}
        onClick={() => setConfirmOpen(true)}
      >
        <RotateCcwIcon className="size-4" />
        {t("agentSettings:history.restore")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={t("agentSettings:history.restoreDialog.title", { revision })}
        description={t("agentSettings:history.restoreDialog.description", { revision })}
        confirmLabel={t("agentSettings:history.restore")}
        confirmIcon={<RotateCcwIcon className="size-5" />}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

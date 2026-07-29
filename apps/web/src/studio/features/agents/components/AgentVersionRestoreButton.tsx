import { Button } from "@caseai-connect/ui/shad/button"
import { RotateCcwIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { restoreAgentSettings } from "@/common/features/agents/settings/agent-settings.thunks"
import { useAppDispatch } from "@/common/store/hooks"

/** One-click restore: copies the selected revision's values into a draft that needs publishing to go live. */
export function AgentVersionRestoreButton({
  agentId,
  revision,
  disabled,
}: {
  agentId: string
  revision: number
  disabled: boolean
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const handleConfirm = async () => {
    setIsRestoring(true)
    try {
      await dispatch(restoreAgentSettings({ agentId, revision })).unwrap()
    } catch {
      // The success and failure notifications are wired in the settings middleware.
    } finally {
      setIsRestoring(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <Button size="sm" disabled={disabled || isRestoring} onClick={() => setConfirmOpen(true)}>
        <RotateCcwIcon className="size-4" />
        {t("agent:history.restore")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={t("agent:history.restoreDialog.title", { revision })}
        description={t("agent:history.restoreDialog.description", { revision })}
        confirmLabel={t("agent:history.restore")}
        confirmIcon={<RotateCcwIcon className="size-5" />}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

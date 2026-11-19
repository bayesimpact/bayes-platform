import { RocketIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { setProductionAgentSettings } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { useAppDispatch } from "@/common/store/hooks"

/**
 * Confirms a change of the production revision. Every live channel switches at once, so the
 * dialog says which version leaves production and that it can come back.
 */
export function SetProductionVersionDialog({
  revision,
  currentRevision,
  onClose,
  onDone,
}: {
  /** The revision to put in production; `null` keeps the dialog closed. */
  revision: number | null
  /** The revision in production now, when there is one. */
  currentRevision: number | undefined
  onClose: () => void
  /** Called once the revision is in production, after the dialog closed. */
  onDone?: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [isConfirming, setIsConfirming] = useState(false)
  // The API's reason when the change failed: the dialog stays open on it.
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleConfirm = async () => {
    if (revision === null) return
    setIsConfirming(true)
    setError(null)
    const result = await dispatch(setProductionAgentSettings({ revision }))
    setIsConfirming(false)
    if (setProductionAgentSettings.fulfilled.match(result)) {
      onClose()
      onDone?.()
      return
    }
    // The agent settings middleware also shows the error notification.
    setError(result.payload || t("agentSettings:notifications.productionSetError"))
  }

  const description = [
    t("agentSettings:production.dialog.description", { revision }),
    currentRevision !== undefined &&
      t("agentSettings:production.dialog.replaces", { current: currentRevision }),
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <ConfirmDialog
      open={revision !== null}
      title={t("agentSettings:production.dialog.title", { revision })}
      description={description}
      confirmLabel={t("agentSettings:production.set")}
      confirmIcon={<RocketIcon className="size-5" />}
      confirmVariant="default"
      isConfirming={isConfirming}
      error={error}
      onConfirm={handleConfirm}
      onCancel={handleClose}
    />
  )
}

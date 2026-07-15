import { Button } from "@caseai-connect/ui/shad/button"
import { RotateCcwIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useAppDispatch } from "@/common/store/hooks"
import { restoreAgentRevision } from "../agent-history.thunks"

/** One-click restore: copies the selected revision's settings as a new (current) revision. */
export function AgentVersionRestoreButton({
  revision,
  disabled,
}: {
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
      await dispatch(restoreAgentRevision({ revision })).unwrap()
    } catch {
      // The studio agents middleware shows the error notification.
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

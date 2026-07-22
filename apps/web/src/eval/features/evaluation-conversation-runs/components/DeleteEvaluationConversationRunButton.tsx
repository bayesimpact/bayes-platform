import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationRunsActions } from "../evaluation-conversation-runs.slice"

export function DeleteEvaluationConversationRunButton({
  runId,
  buttonProps = { variant: "ghost", size: "icon" },
  onDelete,
}: {
  runId: string
  buttonProps?: React.ComponentProps<typeof Button>
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    dispatch(evaluationConversationRunsActions.deleteOne({ evaluationConversationRunId: runId }))
    setOpen(false)
    onDelete?.()
  }

  return (
    <>
      <Button
        {...buttonProps}
        title={t("evaluationConversationRun:history.delete.button")}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        title={t("evaluationConversationRun:history.delete.confirm.title")}
        description={t("evaluationConversationRun:history.delete.confirm.description")}
        confirmLabel={t("actions:delete")}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

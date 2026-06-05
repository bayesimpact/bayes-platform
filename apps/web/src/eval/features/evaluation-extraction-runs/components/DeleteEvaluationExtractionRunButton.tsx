import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationExtractionRunsActions } from "../evaluation-extraction-runs.slice"

export function DeleteEvaluationExtractionRunButton({
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
    dispatch(evaluationExtractionRunsActions.deleteOne({ evaluationExtractionRunId: runId }))
    setOpen(false)
    onDelete?.()
  }

  return (
    <>
      <Button
        {...buttonProps}
        title={t("evaluationExtractionRun:history.delete.button")}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        title={t("evaluationExtractionRun:history.delete.confirm.title")}
        description={t("evaluationExtractionRun:history.delete.confirm.description")}
        confirmLabel={t("evaluationExtractionRun:history.delete.confirm.submit")}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "../evaluation-conversation-datasets.slice"

export function DeleteEvaluationConversationDatasetRecordButton({
  datasetId,
  recordId,
}: {
  datasetId: string
  recordId: string
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    dispatch(evaluationConversationDatasetsActions.deleteRecord({ datasetId, recordId }))
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title={t("evaluationConversationDataset:record.delete.button")}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        title={t("evaluationConversationDataset:record.delete.confirm.title")}
        description={t("evaluationConversationDataset:record.delete.confirm.description")}
        confirmLabel={t("actions:delete")}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

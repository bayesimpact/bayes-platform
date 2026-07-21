import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "../evaluation-conversation-datasets.slice"

export function DeleteEvaluationConversationDatasetButton({
  datasetId,
  buttonProps = { variant: "ghost", size: "icon" },
  onDelete,
}: {
  datasetId: string
  buttonProps?: React.ComponentProps<typeof Button>
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    dispatch(evaluationConversationDatasetsActions.deleteOne({ datasetId }))
    setOpen(false)
    onDelete?.()
  }

  return (
    <>
      <Button
        {...buttonProps}
        title={t("evaluationConversationDataset:dataset.delete.button")}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        title={t("evaluationConversationDataset:dataset.delete.confirm.title")}
        description={t("evaluationConversationDataset:dataset.delete.confirm.description")}
        confirmLabel={t("actions:delete")}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

import { Button } from "@caseai-connect/ui/shad/button"
import { Dialog, DialogContent, DialogTrigger } from "@caseai-connect/ui/shad/dialog"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import type { EvaluationConversationDatasetRecord } from "../evaluation-conversation-datasets.models"
import { evaluationConversationDatasetsActions } from "../evaluation-conversation-datasets.slice"
import {
  EvaluationConversationDatasetRecordForm,
  type EvaluationConversationDatasetRecordFormValues,
} from "./EvaluationConversationDatasetRecordForm"

export function UpdateEvaluationConversationDatasetRecordDialog({
  datasetId,
  record,
}: {
  datasetId: string
  record: EvaluationConversationDatasetRecord
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)

  const handleSubmit = (values: EvaluationConversationDatasetRecordFormValues) => {
    dispatch(
      evaluationConversationDatasetsActions.updateRecord({
        datasetId,
        recordId: record.id,
        input: values.input,
        expectedOutput: values.expectedOutput,
      }),
    )
    setOpen(false)
  }

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={t("evaluationConversationDataset:record.update.button")}
        >
          <PencilIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <EvaluationConversationDatasetRecordForm
          defaultValues={{ input: record.input, expectedOutput: record.expectedOutput }}
          title={t("evaluationConversationDataset:record.update.title")}
          submitLabel={t("actions:save")}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  )
}

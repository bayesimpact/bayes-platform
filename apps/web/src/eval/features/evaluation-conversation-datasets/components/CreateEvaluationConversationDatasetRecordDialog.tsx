import { Button } from "@caseai-connect/ui/shad/button"
import { Dialog, DialogContent, DialogTrigger } from "@caseai-connect/ui/shad/dialog"
import { PlusCircleIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "../evaluation-conversation-datasets.slice"
import {
  EvaluationConversationDatasetRecordForm,
  type EvaluationConversationDatasetRecordFormValues,
} from "./EvaluationConversationDatasetRecordForm"

export function CreateEvaluationConversationDatasetRecordDialog({
  datasetId,
}: {
  datasetId: string
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)

  const handleSubmit = (values: EvaluationConversationDatasetRecordFormValues) => {
    dispatch(
      evaluationConversationDatasetsActions.createRecord({
        datasetId,
        input: values.input,
        expectedOutput: values.expectedOutput,
      }),
    )
    setOpen(false)
  }

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          {t("evaluationConversationDataset:record.create.button")}
          <PlusCircleIcon className="ml-2 size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <EvaluationConversationDatasetRecordForm
          defaultValues={{ input: "", expectedOutput: "" }}
          title={t("evaluationConversationDataset:record.create.title")}
          description={t("evaluationConversationDataset:record.create.description")}
          submitLabel={t("actions:create")}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  )
}

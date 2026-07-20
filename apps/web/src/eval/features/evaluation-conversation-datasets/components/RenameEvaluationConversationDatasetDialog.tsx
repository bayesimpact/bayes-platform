import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import z from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"
import type { EvaluationConversationDataset } from "../evaluation-conversation-datasets.models"

export function RenameEvaluationConversationDatasetDialog({
  dataset,
  buttonProps = {
    variant: "ghost",
    size: "icon",
  },
}: {
  buttonProps?: React.ComponentProps<typeof Button>
  dataset: EvaluationConversationDataset
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...buttonProps} title={t("evaluationConversationDataset:dataset.rename.title")}>
          <PencilIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <RenameForm dataset={dataset} onSubmit={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({
  dataset,
  onSubmit,
}: {
  dataset: EvaluationConversationDataset
  onSubmit: () => void
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  const schema = z.object({
    name: z.string().min(3, t("evaluationConversationDataset:validation.minNameLength")),
  })

  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: dataset.name,
    },
  })

  const handleFormSubmit = (data: FormData) => {
    dispatch(
      evaluationConversationDatasetsActions.renameOne({ datasetId: dataset.id, name: data.name }),
    )
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <DialogHeader>
        <DialogTitle>{t("evaluationConversationDataset:dataset.rename.title")}</DialogTitle>
      </DialogHeader>

      <FieldGroup className="py-4">
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="conversation-dataset-rename">
                {t("evaluationConversationDataset:dataset.props.name")}
              </FieldLabel>
              <Input
                id="conversation-dataset-rename"
                placeholder={t("evaluationConversationDataset:dataset.props.placeholders.name")}
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <DialogFooter>
        <Button type="submit" disabled={!isValid}>
          {t("evaluationConversationDataset:dataset.rename.submit")}
        </Button>
      </DialogFooter>
    </form>
  )
}

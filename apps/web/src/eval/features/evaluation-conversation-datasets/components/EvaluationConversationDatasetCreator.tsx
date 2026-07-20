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
import { PlusCircleIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import z from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"

export function EvaluationConversationDatasetCreator() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="text-base">
          {t("actions:create")}
          <PlusCircleIcon className="ml-2 size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <FormCreation onSubmit={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function FormCreation({ onSubmit }: { onSubmit: () => void }) {
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
    reset: resetForm,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
    },
  })

  const handleFormSubmit = (data: FormData) => {
    dispatch(evaluationConversationDatasetsActions.createOne({ name: data.name }))

    resetForm()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <DialogHeader>
        <DialogTitle>{t("evaluationConversationDataset:dataset.create.title")}</DialogTitle>
      </DialogHeader>

      <FieldGroup className="py-4">
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="conversation-dataset-name">
                {t("evaluationConversationDataset:dataset.props.name")}
              </FieldLabel>
              <Input
                id="conversation-dataset-name"
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
          {t("actions:create")}
        </Button>
      </DialogFooter>
    </form>
  )
}

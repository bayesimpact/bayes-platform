import { Button } from "@caseai-connect/ui/shad/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import z from "zod"

export type EvaluationConversationDatasetRecordFormValues = {
  input: string
  expectedOutput: string
}

export function EvaluationConversationDatasetRecordForm({
  defaultValues,
  title,
  description,
  submitLabel,
  onSubmit,
}: {
  defaultValues: EvaluationConversationDatasetRecordFormValues
  title: string
  description?: string
  submitLabel: string
  onSubmit: (values: EvaluationConversationDatasetRecordFormValues) => void
}) {
  const { t } = useTranslation()

  const schema = z.object({
    input: z.string().min(1, t("evaluationConversationDataset:validation.inputRequired")),
    expectedOutput: z
      .string()
      .min(1, t("evaluationConversationDataset:validation.expectedOutputRequired")),
  })

  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      <FieldGroup className="py-4">
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="conversation-record-input">
                {t("evaluationConversationDataset:record.props.input")}
              </FieldLabel>
              <Textarea
                id="conversation-record-input"
                placeholder={t("evaluationConversationDataset:record.props.placeholders.input")}
                {...register("input")}
                aria-invalid={errors.input ? "true" : "false"}
              />
              {errors.input && <p className="text-sm text-destructive">{errors.input.message}</p>}
            </Field>
            <Field>
              <FieldLabel htmlFor="conversation-record-expected-output">
                {t("evaluationConversationDataset:record.props.expectedOutput")}
              </FieldLabel>
              <Textarea
                id="conversation-record-expected-output"
                placeholder={t(
                  "evaluationConversationDataset:record.props.placeholders.expectedOutput",
                )}
                {...register("expectedOutput")}
                aria-invalid={errors.expectedOutput ? "true" : "false"}
              />
              {errors.expectedOutput && (
                <p className="text-sm text-destructive">{errors.expectedOutput.message}</p>
              )}
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <DialogFooter>
        <Button type="submit" disabled={!isValid}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

import { Button } from "@caseai-connect/ui/shad/button"
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

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

  const schema = useMemo(
    () =>
      z.object({
        input: z.string().min(1, t("evaluationConversationDataset:validation.inputRequired")),
        expectedOutput: z
          .string()
          .min(1, t("evaluationConversationDataset:validation.expectedOutputRequired")),
      }),
    [t],
  )

  type FormData = z.infer<typeof schema>

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <FormField
            control={form.control}
            name="input"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("evaluationConversationDataset:record.props.input")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("evaluationConversationDataset:record.props.placeholders.input")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expectedOutput"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("evaluationConversationDataset:record.props.expectedOutput")}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t(
                      "evaluationConversationDataset:record.props.placeholders.expectedOutput",
                    )}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

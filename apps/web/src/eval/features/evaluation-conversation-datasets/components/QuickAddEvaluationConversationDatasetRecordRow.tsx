import { Button } from "@caseai-connect/ui/shad/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { evaluationConversationDatasetsActions } from "../evaluation-conversation-datasets.slice"

/**
 * Inline quick-add row rendered above the records table. Two single-line inputs make Enter submit
 * naturally; on success the form resets and refocuses the input so the user can keep typing records
 * without touching the mouse. Field state lives in react-hook-form (no useState needed here).
 */
export function QuickAddEvaluationConversationDatasetRecordRow({
  datasetId,
}: {
  datasetId: string
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

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
    defaultValues: { input: "", expectedOutput: "" },
  })

  const handleSubmit = async (values: FormData) => {
    await dispatch(
      evaluationConversationDatasetsActions.createRecord({
        datasetId,
        input: values.input,
        expectedOutput: values.expectedOutput,
      }),
    ).unwrap()
    form.reset({ input: "", expectedOutput: "" })
    form.setFocus("input")
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2"
        aria-label={t("evaluationConversationDataset:record.quickAdd.hint")}
      >
        <FormField
          control={form.control}
          name="input"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
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
            <FormItem className="flex-1">
              <FormControl>
                <Input
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
        <Button type="submit" size="icon" disabled={form.formState.isSubmitting}>
          <PlusIcon className="size-4" />
          <span className="sr-only">
            {t("evaluationConversationDataset:record.quickAdd.addButton")}
          </span>
        </Button>
      </form>
    </Form>
  )
}

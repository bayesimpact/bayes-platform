import {
  getOrderedPropertyEntries,
  outputJsonSchemaSchema,
  updateAgentOutputSchema,
} from "@caseai-connect/api-contracts"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Form, FormField } from "@caseai-connect/ui/shad/form"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { updateAgentOutput } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, useReportDirty } from "./agent-tab-form.shared"
import { QuestionOrderEditor } from "./QuestionOrderEditor"

type FormValues = z.infer<typeof updateAgentOutputSchema>

export function AgentOutputTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentOutputSchema),
    defaultValues: { outputJsonSchema: agent.outputJsonSchema ?? {} },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  // The resolver validates outputJsonSchema as an object and nests errors under sub-paths,
  // so we track the parse/validation error in local state for a reliable inline message.
  const [jsonError, setJsonError] = useState<string | null>(null)
  // The JSON textarea is uncontrolled (defaultValue) so free-form typing works; bump this to
  // remount it when the question-order UI mutates the schema, so the text stays in sync.
  const [schemaVersion, setSchemaVersion] = useState(0)

  const currentSchema = form.watch("outputJsonSchema")
  const parsedSchema = outputJsonSchemaSchema.safeParse(currentSchema)
  const orderMatters = parsedSchema.success && (parsedSchema.data.propertyOrdering?.length ?? 0) > 0
  const orderedQuestions = parsedSchema.success
    ? getOrderedPropertyEntries(parsedSchema.data).map(([key, value]) => ({
        key,
        description: value.description,
      }))
    : []

  const applySchemaChange = (nextSchema: z.infer<typeof outputJsonSchemaSchema>) => {
    form.setValue("outputJsonSchema", nextSchema, { shouldDirty: true, shouldValidate: true })
    setJsonError(null)
    setSchemaVersion((version) => version + 1)
  }

  const handleToggleOrder = (checked: boolean) => {
    if (!parsedSchema.success) return
    if (checked) {
      applySchemaChange({
        ...parsedSchema.data,
        propertyOrdering: getOrderedPropertyEntries(parsedSchema.data).map(([key]) => key),
      })
      return
    }
    const { propertyOrdering: _dropped, ...rest } = parsedSchema.data
    applySchemaChange(rest)
  }

  const handleReorder = (orderedKeys: string[]) => {
    if (!parsedSchema.success) return
    applySchemaChange({ ...parsedSchema.data, propertyOrdering: orderedKeys })
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    await dispatch(updateAgentOutput({ agentId: agent.id, fields: values })).unwrap()
    form.reset(values)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="outputJsonSchema"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="outputJsonSchema">
                {t("agent:props.outputJsonSchema")}
              </FieldLabel>
              <Textarea
                key={schemaVersion}
                id="outputJsonSchema"
                rows={10}
                className="font-mono min-h-56"
                defaultValue={field.value ? JSON.stringify(field.value, null, 2) : ""}
                aria-invalid={jsonError ? "true" : "false"}
                onChange={(event) => {
                  const raw = event.target.value
                  if (raw.trim() === "") {
                    field.onChange({}, { shouldDirty: true })
                    setJsonError(null)
                    return
                  }
                  try {
                    const parsed = JSON.parse(raw)
                    const validationResult = outputJsonSchemaSchema.safeParse(parsed)
                    field.onChange(parsed)
                    setJsonError(
                      validationResult.success
                        ? null
                        : (validationResult.error.issues.at(0)?.message ??
                            t("agent:props.validation.outputJsonSchemaInvalid")),
                    )
                  } catch {
                    field.onChange(raw)
                    setJsonError(t("agent:props.validation.outputJsonSchemaInvalid"))
                  }
                }}
              />
              {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
            </Field>
          )}
        />

        <Field>
          <div className="flex items-center gap-2">
            <Switch
              id="questionOrderImportant"
              checked={orderMatters}
              disabled={!parsedSchema.success}
              onCheckedChange={handleToggleOrder}
            />
            <FieldLabel htmlFor="questionOrderImportant" className="mb-0">
              {t("agent:props.questionOrder.important")}
            </FieldLabel>
          </div>
          <p className="text-sm text-muted-foreground">{t("agent:props.questionOrder.hint")}</p>
          {orderMatters && (
            <QuestionOrderEditor questions={orderedQuestions} onReorder={handleReorder} />
          )}
        </Field>

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
        />
      </form>
    </Form>
  )
}

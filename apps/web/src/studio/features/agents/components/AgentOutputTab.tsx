import { outputJsonSchemaSchema, updateAgentOutputSchema } from "@caseai-connect/api-contracts"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Form, FormField } from "@caseai-connect/ui/shad/form"
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

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
        />
      </form>
    </Form>
  )
}

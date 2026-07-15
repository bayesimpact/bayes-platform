import { outputJsonSchemaSchema, updateAgentOutputSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Field } from "@caseai-connect/ui/shad/field"
import { Form, FormField } from "@caseai-connect/ui/shad/form"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { CodeIcon, ListIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { updateAgentOutput } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, useReportDirty } from "./agent-tab-form.shared"
import { OutputSchemaBuilder } from "./OutputSchemaBuilder"

type FormValues = z.infer<typeof updateAgentOutputSchema>

export function AgentOutputTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentOutputSchema),
    defaultValues: { outputJsonSchema: agent.outputJsonSchema ?? {} },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  // The JSON textarea (advanced mode) is hidden by default behind the visual builder. When the
  // raw JSON is invalid we keep the author in advanced mode so switching to the builder — which
  // can only render a valid schema — never silently discards their in-progress edits. `version`
  // is a remount key: bumping it re-seeds the builder/textarea from the form value (used on
  // cancel, since both hold their own internal editing state). Kept in one object to stay within
  // the tab's local-state budget.
  const [editor, setEditor] = useState<{
    advancedMode: boolean
    jsonError: string | null
    version: number
  }>({ advancedMode: false, jsonError: null, version: 0 })
  const { advancedMode, jsonError, version } = editor

  const handleSubmit = form.handleSubmit(async (values) => {
    await dispatch(updateAgentOutput({ agentId: agent.id, fields: values })).unwrap()
    form.reset(values)
  })

  const handleCancel = () => {
    form.reset()
    setEditor((previous) => ({
      advancedMode: false,
      jsonError: null,
      version: previous.version + 1,
    }))
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="outputJsonSchema"
          render={({ field }) => (
            <Field>
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={advancedMode && jsonError !== null}
                  onClick={() =>
                    setEditor((previous) => ({ ...previous, advancedMode: !previous.advancedMode }))
                  }
                >
                  {advancedMode ? <ListIcon /> : <CodeIcon />}
                  {advancedMode
                    ? t("agent:props.schemaBuilder.visualMode")
                    : t("agent:props.schemaBuilder.advancedMode")}
                </Button>
              </div>

              {advancedMode ? (
                <>
                  <Textarea
                    key={version}
                    id="outputJsonSchema"
                    rows={10}
                    className="font-mono min-h-56"
                    defaultValue={field.value ? JSON.stringify(field.value, null, 2) : ""}
                    aria-invalid={jsonError ? "true" : "false"}
                    onChange={(event) => {
                      const raw = event.target.value
                      if (raw.trim() === "") {
                        field.onChange({})
                        setEditor((previous) => ({ ...previous, jsonError: null }))
                        return
                      }
                      try {
                        const parsed = JSON.parse(raw)
                        const validationResult = outputJsonSchemaSchema.safeParse(parsed)
                        field.onChange(parsed)
                        setEditor((previous) => ({
                          ...previous,
                          jsonError: validationResult.success
                            ? null
                            : (validationResult.error.issues.at(0)?.message ??
                              t("agent:props.validation.outputJsonSchemaInvalid")),
                        }))
                      } catch {
                        field.onChange(raw)
                        setEditor((previous) => ({
                          ...previous,
                          jsonError: t("agent:props.validation.outputJsonSchemaInvalid"),
                        }))
                      }
                    }}
                  />
                  {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
                </>
              ) : (
                <OutputSchemaBuilder
                  key={version}
                  value={field.value}
                  allowOrdering={agent.type === "form"}
                  onChange={(schema) => field.onChange(schema)}
                />
              )}
            </Field>
          )}
        />

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
          onCancel={handleCancel}
        />
      </form>
    </Form>
  )
}

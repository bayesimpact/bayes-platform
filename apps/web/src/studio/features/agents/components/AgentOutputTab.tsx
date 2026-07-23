import { updateAgentOutputSchema } from "@caseai-connect/api-contracts"
import { Field } from "@caseai-connect/ui/shad/field"
import { Form, FormField } from "@caseai-connect/ui/shad/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { updateAgentOutput } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, useReportDirty } from "./agent-tab-form.shared"
import { OutputSchemaField } from "./OutputSchemaField"

type FormValues = z.infer<typeof updateAgentOutputSchema>

export function AgentOutputTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const dispatch = useAppDispatch()

  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentOutputSchema),
    defaultValues: { outputJsonSchema: agent.outputJsonSchema ?? {} },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  // Remount key for the schema editor: bumping it re-seeds the builder/textarea
  // from the form value (used on cancel, since both hold their own editing state).
  const [editorVersion, setEditorVersion] = useState(0)

  const handleSubmit = form.handleSubmit(async (values) => {
    await dispatch(updateAgentOutput({ agentId: agent.id, fields: values })).unwrap()
    form.reset(values)
  })

  const handleCancel = () => {
    form.reset()
    setEditorVersion((previous) => previous + 1)
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="outputJsonSchema"
          render={({ field }) => (
            <Field>
              <OutputSchemaField
                key={editorVersion}
                value={field.value}
                onChange={(schema) => field.onChange(schema)}
                allowOrdering={false}
              />
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

import { updateAgentSettingsOutputSchema } from "@bayes-platform/api-contracts"
import { Field } from "@bayes-platform/ui/shad/field"
import { Form, FormField } from "@bayes-platform/ui/shad/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { updateAgentSettingsOutput } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { useAppDispatch } from "@/common/store/hooks"
import { type AgentTabFormProps, useAutosave } from "../agent-tab-form.shared"
import { OutputSchemaField } from "../OutputSchemaField"

type FormValues = z.infer<typeof updateAgentSettingsOutputSchema>

export function OutputTab({ agentSettings, saveControl }: AgentTabFormProps) {
  const dispatch = useAppDispatch()

  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentSettingsOutputSchema),
    shouldFocusError: false,
    defaultValues: { outputJsonSchema: agentSettings.outputJsonSchema ?? {} },
  })
  const { onSubmit } = useAutosave({
    form,
    saveControl,
    save: async ({ values }) => {
      await dispatch(
        updateAgentSettingsOutput({ agentId: agentSettings.agentId, fields: values }),
      ).unwrap()
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="outputJsonSchema"
          render={({ field }) => (
            <Field>
              <OutputSchemaField
                value={field.value}
                onChange={(schema) => field.onChange(schema)}
                allowOrdering={false}
              />
            </Field>
          )}
        />
      </form>
    </Form>
  )
}

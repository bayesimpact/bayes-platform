import { type UpdateAgentToolsDto, updateAgentToolsSchema } from "@caseai-connect/api-contracts"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import { updateAgentTools } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, pickDirtyFields, useReportDirty } from "./agent-tab-form.shared"
import { OutputSchemaField } from "./OutputSchemaField"

/**
 * Optional tools of a conversation agent. Each tool is a list entry with an
 * enable switch and, when enabled, its config panel. fillForm is the first (and
 * currently only) entry; its config is the form definition (the agent's
 * outputJsonSchema).
 */
export function AgentToolsTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const form = useForm<UpdateAgentToolsDto>({
    resolver: zodResolver(updateAgentToolsSchema),
    defaultValues: {
      fillFormEnabled: agent.fillFormEnabled,
      outputJsonSchema: agent.outputJsonSchema,
    },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  // Remount key for the schema editor: bumping it re-seeds the builder/textarea
  // from the form value (used on cancel, since both hold their own editing state).
  const [editorVersion, setEditorVersion] = useState(0)

  const handleSubmit = form.handleSubmit(async (values) => {
    // PATCH only what changed — re-sending an unchanged outputJsonSchema would
    // mint a spurious agent-settings revision. Enabling the tool always sends
    // the schema alongside the flag (the API requires them together).
    const changedFields = pickDirtyFields(values, form.formState.dirtyFields)
    const fields: UpdateAgentToolsDto = {
      fillFormEnabled: values.fillFormEnabled,
      ...changedFields,
      ...(values.fillFormEnabled ? { outputJsonSchema: values.outputJsonSchema } : {}),
    }
    await dispatch(updateAgentTools({ agentId: agent.id, fields })).unwrap()
    form.reset(values)
  })

  const handleCancel = () => {
    form.reset()
    setEditorVersion((previous) => previous + 1)
  }

  const fillFormEnabled = form.watch("fillFormEnabled")

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <FormField
            control={form.control}
            name="fillFormEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <FormLabel>{t("agent:tools.fillForm.title")}</FormLabel>
                  <FormDescription>{t("agent:tools.fillForm.description")}</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {fillFormEnabled && (
            <FormField
              control={form.control}
              name="outputJsonSchema"
              render={({ field }) => (
                <FormItem>
                  <FormDescription>{t("agent:tools.fillForm.schemaDescription")}</FormDescription>
                  <OutputSchemaField
                    key={editorVersion}
                    value={field.value}
                    onChange={(schema) => field.onChange(schema)}
                    allowOrdering
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
          onCancel={handleCancel}
        />
      </form>
    </Form>
  )
}

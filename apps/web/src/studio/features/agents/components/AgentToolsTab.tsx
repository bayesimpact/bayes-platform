import { updateAgentSettingsSchema } from "@caseai-connect/api-contracts"
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
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { updateAgentSettings } from "@/common/features/agents/settings/agent-settings.thunks"
import { useAppDispatch } from "@/common/store/hooks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, pickDirtyFields, useReportDirty } from "./agent-tab-form.shared"
import { OutputSchemaField } from "./OutputSchemaField"

const toolsPickedSchema = updateAgentSettingsSchema
  .pick({ fillFormEnabled: true, outputJsonSchema: true })
  .required({ fillFormEnabled: true })

type FormValues = z.infer<typeof toolsPickedSchema>

/**
 * Optional tools of a conversation agent. Each tool is a list entry with an
 * enable switch and, when enabled, its config panel. fillForm is the first (and
 * currently only) entry; its config is the form definition (the agent's
 * outputJsonSchema).
 */
export function AgentToolsTab({ agent, settings, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  // Client-side only: the contract schema cannot enforce "fillForm requires a schema" because
  // each field is independently optional there (a PATCH may omit either, and the API merges the
  // payload over the stored revision before checking). This form always carries both fields, so
  // the refine is meaningful here.
  const toolsFormSchema = useMemo(
    () =>
      toolsPickedSchema.refine((data) => !data.fillFormEnabled || !!data.outputJsonSchema, {
        message: t("agent:tools.fillForm.schemaRequired"),
        path: ["outputJsonSchema"],
      }),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(toolsFormSchema),
    defaultValues: {
      fillFormEnabled: settings.fillFormEnabled,
      outputJsonSchema: settings.outputJsonSchema,
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
    const fields: FormValues = {
      fillFormEnabled: values.fillFormEnabled,
      ...changedFields,
      ...(values.fillFormEnabled ? { outputJsonSchema: values.outputJsonSchema } : {}),
    }
    await dispatch(updateAgentSettings({ agentId: agent.id, fields })).unwrap()
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

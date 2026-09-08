import { updateAgentSettingsModelSchema } from "@caseai-connect/api-contracts"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import {
  buildAgentModelOptions,
  formatAgentModelLabel,
  isPriorityCallsAvailable,
} from "@/common/features/agents/agent-model.helpers"
import { updateAgentSettingsModel } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { type AgentTabFormProps, pickDirtyFields, useReportDirty } from "../agent-tab-form.shared"
import { TabSaveButton } from "./TabSaveButton"

type FormValues = z.infer<typeof updateAgentSettingsModelSchema>

export function ModelTab({ agentSettings, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const models = buildAgentModelOptions(hasFeature)

  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentSettingsModelSchema),
    defaultValues: {
      model: agentSettings.model,
      temperature: agentSettings.temperature,
      priorityCallsEnabled: agentSettings.priorityCallsEnabled,
    },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  // The priority tier only exists for Gemini 3.x models and needs the project flag. It follows
  // the model currently picked in the form, so switching to another provider hides it.
  const selectedModel = form.watch("model")
  const priorityCallsAvailable = isPriorityCallsAvailable({ hasFeature, model: selectedModel })

  const handleSubmit = form.handleSubmit(async (values) => {
    const fields = pickDirtyFields(values, form.formState.dirtyFields)
    if (!priorityCallsAvailable && values.priorityCallsEnabled) fields.priorityCallsEnabled = false
    await dispatch(updateAgentSettingsModel({ agentId: agentSettings.agentId, fields })).unwrap()
    form.reset({
      ...values,
      priorityCallsEnabled: fields.priorityCallsEnabled ?? values.priorityCallsEnabled,
    })
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agentSettings:props.model")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("agentSettings:props.placeholders.model")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {formatAgentModelLabel(model, {
                          deprecatedSuffix: t("agent:model.deprecatedSuffix"),
                          nonEuSuffix: t("agent:model.nonEuSuffix"),
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="temperature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agentSettings:props.temperature")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="2"
                    placeholder={t("agentSettings:props.placeholders.temperature")}
                    {...field}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {priorityCallsAvailable && (
          <FormField
            control={form.control}
            name="priorityCallsEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <FormLabel>{t("agentSettings:model.priorityCalls.title")}</FormLabel>
                  <FormDescription>
                    {t("agentSettings:model.priorityCalls.description")}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <TabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
          onCancel={() => form.reset()}
        />
      </form>
    </Form>
  )
}

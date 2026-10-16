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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import {
  buildAgentModelOptions,
  describeModelOptionFields,
  findAgentModelEntry,
  formatAgentModelLabel,
  isPriorityCallsAvailable,
  readModelOption,
} from "@/common/features/agents/agent-model.helpers"
import { updateAgentSettingsModel } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { selectAvailableModelsData } from "@/common/features/agents/agents.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { type AgentTabFormProps, useReportDirty } from "../agent-tab-form.shared"
import { ModelOptionsFields } from "./ModelOptionsFields"
import {
  buildModelTabDefaultValues,
  buildModelTabSubmit,
  defaultModelOptions,
} from "./model-tab.helpers"
import { TabSaveButton } from "./TabSaveButton"

type FormValues = z.infer<typeof updateAgentSettingsModelSchema>

export function ModelTab({ agentSettings, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const catalog = useValue(selectAvailableModelsData)
  const models = buildAgentModelOptions(catalog)
  const modelLabelSuffixes = {
    deprecatedSuffix: t("agent:model.deprecatedSuffix"),
    nonEuSuffix: t("agent:model.nonEuSuffix"),
  }

  // The contract schema, plus the temperature range of the selected model (from its schema).
  const formSchema = useMemo(
    () =>
      updateAgentSettingsModelSchema.superRefine((values, context) => {
        const range = describeModelOptionFields(
          findAgentModelEntry(catalog, values.model),
        ).temperature
        const temperature = readModelOption(values.providerOptions, ["temperature"])
        if (!range) return
        if (
          typeof temperature !== "number" ||
          Number.isNaN(temperature) ||
          (range.minimum !== undefined && temperature < range.minimum) ||
          (range.maximum !== undefined && temperature > range.maximum)
        )
          context.addIssue({
            code: "custom",
            path: ["providerOptions"],
            message: t("agentSettings:props.validation.temperatureInvalid"),
          })
      }),
    [catalog, t],
  )
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildModelTabDefaultValues(agentSettings),
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  // The priority tier only exists for Gemini 3.x models and needs the project flag. It follows
  // the model currently picked in the form, so switching to another provider hides it.
  const selectedModel = form.watch("model")
  const optionFields = describeModelOptionFields(findAgentModelEntry(catalog, selectedModel))
  const priorityCallsAvailable = isPriorityCallsAvailable({ hasFeature, model: selectedModel })

  const handleSubmit = form.handleSubmit(async (values) => {
    const { fields, resetValues } = buildModelTabSubmit({
      values,
      dirtyFields: form.formState.dirtyFields,
      priorityCallsAvailable,
    })
    await dispatch(updateAgentSettingsModel({ agentId: agentSettings.agentId, fields })).unwrap()
    form.reset(resetValues)
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
                <Select
                  onValueChange={(model) => {
                    field.onChange(model)
                    // A new model starts on its own default options.
                    form.setValue("providerOptions", defaultModelOptions(catalog, model), {
                      shouldDirty: true,
                    })
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("agentSettings:props.placeholders.model")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* The agent's model stays shown once the project can no longer pick it. */}
                    {!models.includes(agentSettings.model) && (
                      <SelectItem value={agentSettings.model} disabled>
                        {formatAgentModelLabel(agentSettings.model, catalog, modelLabelSuffixes)}
                      </SelectItem>
                    )}
                    {models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {formatAgentModelLabel(model, catalog, modelLabelSuffixes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!models.includes(field.value) && (
                  <FormDescription className="text-destructive">
                    {t("agent:model.unavailable")}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="providerOptions"
            render={({ field }) => (
              <FormItem className="contents">
                <ModelOptionsFields
                  fields={optionFields}
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage className="md:col-span-2" />
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

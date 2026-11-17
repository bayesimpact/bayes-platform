import {
  AgentMemoryMode,
  FOLLOW_UP_SUGGESTIONS_INSTRUCTIONS_MAX_LENGTH,
  FOLLOW_UP_SUGGESTIONS_MAX,
  type UpdateAgentSettingsToolsDto,
  updateAgentSettingsToolsSchema,
} from "@caseai-connect/api-contracts"
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
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { updateAgentSettingsTools } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { useAppDispatch } from "@/common/store/hooks"
import { type AgentTabFormProps, useAutosave } from "../agent-tab-form.shared"
import { OutputSchemaField } from "../OutputSchemaField"

/**
 * Optional tools of a conversation agent. Each tool is a list entry with an
 * enable switch and, when enabled, its config panel. fillForm is the first (and
 * currently only) entry; its config is the form definition (the agent's
 * outputJsonSchema).
 */
export function ToolsTab({ agentSettings, saveControl }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const form = useForm<UpdateAgentSettingsToolsDto>({
    resolver: zodResolver(updateAgentSettingsToolsSchema),
    shouldFocusError: false,
    defaultValues: {
      fillFormEnabled: agentSettings.fillFormEnabled,
      outputJsonSchema: agentSettings.outputJsonSchema,
      memoryMode: agentSettings.memoryMode,
      followUpSuggestionsEnabled: agentSettings.followUpSuggestionsEnabled,
      followUpSuggestionsInstructions: agentSettings.followUpSuggestionsInstructions,
      followUpSuggestionsMax: agentSettings.followUpSuggestionsMax,
    },
  })
  const { onSubmit } = useAutosave({
    form,
    saveControl,
    save: async ({ values, changed }) => {
      // PATCH only what changed — re-sending an unchanged outputJsonSchema would
      // mint a spurious agent-settings revision. Enabling the tool always sends
      // the schema alongside the flag (the API requires them together).
      const fields: UpdateAgentSettingsToolsDto = {
        fillFormEnabled: values.fillFormEnabled,
        ...changed,
        ...(values.fillFormEnabled ? { outputJsonSchema: values.outputJsonSchema } : {}),
      }
      await dispatch(updateAgentSettingsTools({ agentId: agentSettings.agentId, fields })).unwrap()
    },
  })

  const fillFormEnabled = form.watch("fillFormEnabled")
  const followUpSuggestionsEnabled = form.watch("followUpSuggestionsEnabled")

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <FormField
            control={form.control}
            name="fillFormEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <FormLabel>{t("agentSettings:tools.fillForm.title")}</FormLabel>
                  <FormDescription>{t("agentSettings:tools.fillForm.description")}</FormDescription>
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
                  <FormDescription>
                    {t("agentSettings:tools.fillForm.schemaDescription")}
                  </FormDescription>
                  <OutputSchemaField
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

        <div className="rounded-lg border p-4 space-y-4">
          <FormField
            control={form.control}
            name="followUpSuggestionsEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <FormLabel>{t("agentSettings:tools.followUpSuggestions.title")}</FormLabel>
                  <FormDescription>
                    {t("agentSettings:tools.followUpSuggestions.description")}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {followUpSuggestionsEnabled && (
            <>
              <FormField
                control={form.control}
                name="followUpSuggestionsMax"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4">
                    <FormLabel>{t("agentSettings:tools.followUpSuggestions.max")}</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-24 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from(
                          { length: FOLLOW_UP_SUGGESTIONS_MAX },
                          (_, index) => index + 1,
                        ).map((maxQuestions) => (
                          <SelectItem key={maxQuestions} value={String(maxQuestions)}>
                            {maxQuestions}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="followUpSuggestionsInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("agentSettings:tools.followUpSuggestions.instructions")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value || null)}
                        maxLength={FOLLOW_UP_SUGGESTIONS_INSTRUCTIONS_MAX_LENGTH}
                        placeholder={t(
                          "agentSettings:tools.followUpSuggestions.instructionsPlaceholder",
                        )}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("agentSettings:tools.followUpSuggestions.instructionsDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>

        <RestrictedFeature feature="agent-memory">
          <div className="rounded-lg border p-4">
            <FormField
              control={form.control}
              name="memoryMode"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <FormLabel>{t("agentSettings:tools.memory.title")}</FormLabel>
                    <FormDescription>{t("agentSettings:tools.memory.description")}</FormDescription>
                  </div>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-56 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(AgentMemoryMode).map((memoryMode) => (
                        <SelectItem key={memoryMode} value={memoryMode}>
                          {t(`agentSettings:tools.memory.modes.${memoryMode}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
        </RestrictedFeature>
      </form>
    </Form>
  )
}

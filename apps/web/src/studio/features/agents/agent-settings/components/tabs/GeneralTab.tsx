import {
  AgentLocale,
  extractPromptVariables,
  updateAgentSettingsGeneralSchema,
} from "@caseai-connect/api-contracts"
import {
  Form,
  FormControl,
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
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { updateAgentSettingsGeneral } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { PromptVariablesEditor } from "@/studio/features/agents/prompt-variables/PromptVariablesEditor"
import { type AgentTabFormProps, pickDirtyFields, useReportDirty } from "../agent-tab-form.shared"
import { TabSaveButton } from "./TabSaveButton"

type FormValues = z.infer<typeof updateAgentSettingsGeneralSchema>

export function GeneralTab({
  agent,
  agentSettings,
  onDirtyChange,
}: AgentTabFormProps & {
  agent: Agent
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const hasGreetingMessage = agent.type === "conversation"
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)

  const declaredPromptVariables = extractPromptVariables(agentSettings.instructions)
  const showPromptVariables =
    hasFeature("agent-prompt-variables") && declaredPromptVariables.length > 0

  // The {{variables}} defaults are a settings field: edited right under the instructions
  // that declare them and saved with the same button. The tab remounts on every settings
  // change (keyed on revision + updatedAt), so the state seeds from the prop.
  const [promptVariables, setPromptVariables] = useState<Record<string, string>>(() => ({
    ...(agentSettings.variables ?? {}),
  }))
  const promptVariablesDirty =
    JSON.stringify(promptVariables) !== JSON.stringify(agentSettings.variables ?? {})

  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentSettingsGeneralSchema),
    defaultValues: {
      name: agent.name,
      locale: agentSettings.locale,
      instructions: agentSettings.instructions,
      greetingMessage: agentSettings.greetingMessage ?? null,
    },
  })
  useReportDirty(form.formState.isDirty || promptVariablesDirty, onDirtyChange)

  const handleSubmit = form.handleSubmit(async (values) => {
    const fields = {
      ...pickDirtyFields(values, form.formState.dirtyFields),
      ...(promptVariablesDirty && {
        variables: variablesPayload(promptVariables),
      }),
    }
    if (Object.keys(fields).length === 0) return
    await dispatch(updateAgentSettingsGeneral({ agentId: agent.id, fields })).unwrap()
    // Back to the stored values until the refetch re-seeds the tab (it remounts on the
    // new updatedAt), so the dirty state clears with the save.
    form.reset(values)
    setPromptVariables({ ...(agentSettings.variables ?? {}) })
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agent:props.name")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("agent:props.placeholders.name")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agentSettings:props.locale")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("agentSettings:props.placeholders.locale")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(AgentLocale).map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {hasGreetingMessage && (
          <FormField
            control={form.control}
            name="greetingMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agentSettings:props.greeting")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("agentSettings:props.placeholders.greeting")}
                    rows={3}
                    className="min-h-40 max-h-96 font-mono"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(event.target.value === "" ? null : event.target.value)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("agentSettings:props.instructions")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("agentSettings:props.placeholders.instructions")}
                  rows={8}
                  className="min-h-40 max-h-96 font-mono"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showPromptVariables && (
          <PromptVariablesEditor
            title={t("agentSettings:promptVariables.title")}
            description={t("agentSettings:promptVariables.description")}
            fields={declaredPromptVariables.map((name) => ({
              name,
              value: promptVariables[name] ?? "",
            }))}
            onChange={setPromptVariables}
          />
        )}

        <TabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty || promptVariablesDirty}
          onCancel={() => {
            form.reset()
            setPromptVariables({ ...(agentSettings.variables ?? {}) })
          }}
        />
      </form>
    </Form>
  )
}

/**
 * The variables payload of the save: blank entries are dropped, and an all-blank map is
 * sent as `null` (no defaults).
 */
function variablesPayload(values: Record<string, string>): Record<string, string> | null {
  const defaults = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value.trim().length > 0),
  )
  return Object.keys(defaults).length > 0 ? defaults : null
}

import {
  extractPromptVariables,
  GREETING_MESSAGE_MAX_LENGTH,
  updateAgentSettingsGeneralSchema,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { GitCompareIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { agentSettingsDiffFileNames } from "@/common/features/agents/agent-settings/agent-settings.functions"
import { selectAgentSettingsDataByAgentId } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { updateAgentSettingsGeneral } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { PromptVariablesEditor } from "@/studio/features/agents/prompt-variables/PromptVariablesEditor"
import { type AgentTabFormProps, useAutosave } from "../agent-tab-form.shared"
import { TextDiff } from "../TextDiff"

type FormValues = z.infer<typeof updateAgentSettingsGeneralSchema>

export function GeneralTab({
  agent,
  agentSettings,
  saveControl,
}: AgentTabFormProps & { agent: Agent }) {
  const [isDiffRequested, setIsDiffRequested] = useState(false)
  // Undefined for an agent that was never published: it has nothing to compare with.
  const publishedInstructions = useAppSelector(
    selectAgentSettingsDataByAgentId({ agentId: agent.id }),
  ).value?.instructions
  const { t, i18n } = useTranslation()
  const dispatch = useAppDispatch()
  const hasGreetingMessage = agent.type === "conversation"
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)

  const declaredPromptVariables = extractPromptVariables(agentSettings.instructions)
  const showPromptVariables =
    hasFeature("agent-prompt-variables") && declaredPromptVariables.length > 0

  // The {{variables}} defaults are a settings field: edited right under the instructions
  // that declare them, and saved with them.
  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentSettingsGeneralSchema),
    shouldFocusError: false,
    defaultValues: {
      name: agent.name,
      instructions: agentSettings.instructions,
      greetingMessage: agentSettings.greetingMessage ?? null,
      variables: { ...(agentSettings.variables ?? {}) },
    },
  })
  const { onSubmit } = useAutosave({
    form,
    saveControl,
    save: async ({ changed }) => {
      const fields = { ...changed }
      if ("variables" in changed) fields.variables = variablesPayload(changed.variables ?? {})
      await dispatch(updateAgentSettingsGeneral({ agentId: agent.id, fields })).unwrap()
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
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
        </div>

        {hasGreetingMessage && (
          <FormField
            control={form.control}
            name="greetingMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("agentSettings:props.greeting")}
                  <span className="font-normal text-muted-foreground">
                    {t("agentSettings:props.characterCountWithMax", {
                      current: (field.value ?? "").length.toLocaleString(i18n.language),
                      max: GREETING_MESSAGE_MAX_LENGTH.toLocaleString(i18n.language),
                    })}
                  </span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("agentSettings:props.placeholders.greeting")}
                    // Two lines tall when empty, then as tall as its text: the page scrolls.
                    className="min-h-16 resize-none font-mono"
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
          render={({ field }) => {
            // Nothing to compare for an agent that was never published.
            const isDiffShown = isDiffRequested && publishedInstructions !== undefined
            // The button stays while the diff is open, even once the text is back to the
            // published one: the diff must not close under the user's cursor.
            const canShowDiff =
              isDiffShown ||
              (publishedInstructions !== undefined && field.value !== publishedInstructions)
            return (
              <FormItem>
                <div className="flex min-h-8 items-center justify-between gap-4">
                  <FormLabel>
                    {t("agentSettings:props.instructions")}
                    <span className="font-normal text-muted-foreground">
                      {t("agentSettings:props.characterCount", {
                        count: field.value.length,
                        formattedCount: field.value.length.toLocaleString(i18n.language),
                      })}
                    </span>
                  </FormLabel>
                  {canShowDiff && (
                    <Button
                      type="button"
                      variant={isDiffShown ? "default" : "outline"}
                      size="sm"
                      aria-pressed={isDiffShown}
                      onClick={() => setIsDiffRequested(!isDiffShown)}
                    >
                      <GitCompareIcon />
                      {t("agentSettings:history.advancedMode")}
                    </Button>
                  )}
                </div>
                {isDiffShown ? (
                  // The diff with the published instructions takes the place of the field, and
                  // the instructions are edited in it.
                  <TextDiff
                    name={agentSettingsDiffFileNames.instructions}
                    before={publishedInstructions}
                    after={field.value}
                    onChange={field.onChange}
                  />
                ) : (
                  <FormControl>
                    {/* It grows with its text, with no height limit: the page scrolls, not the field. */}
                    <Textarea
                      placeholder={t("agentSettings:props.placeholders.instructions")}
                      className="min-h-40 resize-none font-mono"
                      {...field}
                    />
                  </FormControl>
                )}
                <FormMessage />
              </FormItem>
            )
          }}
        />

        {showPromptVariables && (
          <FormField
            control={form.control}
            name="variables"
            render={({ field }) => (
              <PromptVariablesEditor
                title={t("agentSettings:promptVariables.title")}
                description={t("agentSettings:promptVariables.description")}
                fields={declaredPromptVariables.map((name) => ({
                  name,
                  value: field.value?.[name] ?? "",
                }))}
                onChange={field.onChange}
              />
            )}
          />
        )}
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

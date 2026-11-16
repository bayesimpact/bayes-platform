import {
  extractPromptVariables,
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
import { PencilIcon } from "lucide-react"
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
import { type AgentTabFormProps, useAutosave } from "../agent-tab-form.shared"
import { InstructionsSheet } from "../sheets/InstructionsSheet"

type FormValues = z.infer<typeof updateAgentSettingsGeneralSchema>

export function GeneralTab({
  agent,
  agentSettings,
  saveControl,
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
  const [isEditingInstructions, setIsEditingInstructions] = useState(false)
  const { onSubmit, saveState, saveNow } = useAutosave({
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
              {/* The instructions are long: the tab shows the start of them, and a full-page
                  sheet gives the room to write them. */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium leading-none">
                  {t("agentSettings:props.instructions")}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingInstructions(true)}
                >
                  <PencilIcon className="size-4" />
                  {t("actions:edit")}
                </Button>
              </div>
              <button
                type="button"
                aria-label={t("agentSettings:editor.openInstructions")}
                onClick={() => setIsEditingInstructions(true)}
                className="w-full rounded-md border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {field.value ? (
                  <span className="line-clamp-6 font-mono text-sm break-words whitespace-pre-wrap">
                    {field.value}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("agentSettings:props.placeholders.instructions")}
                  </span>
                )}
              </button>
              <FormMessage />

              <InstructionsSheet
                open={isEditingInstructions}
                onClose={() => setIsEditingInstructions(false)}
                saveState={saveState}
                hasDraft={agentSettings.isDraft}
                onRetrySave={saveNow}
              >
                <FormControl>
                  <Textarea
                    aria-label={t("agentSettings:props.instructions")}
                    placeholder={t("agentSettings:props.placeholders.instructions")}
                    className="min-h-0 flex-1 resize-none font-mono [field-sizing:fixed]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </InstructionsSheet>
            </FormItem>
          )}
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

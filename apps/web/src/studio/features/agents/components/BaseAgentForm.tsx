import { AgentLocale, createAgentSchema, updateAgentSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldGroup, FieldSet } from "@caseai-connect/ui/shad/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Controller, type FieldErrors, FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { AgentEmbedTab } from "@/studio/features/agent-embed-configs/components/AgentEmbedTab"
import { AgentGeneralTab } from "./AgentGeneralTab"
import { AgentModelTab } from "./AgentModelTab"
import { AgentOutputTab } from "./AgentOutputTab"
import { AgentSessionCategoriesTab } from "./AgentSessionCategoriesTab"
import { AgentSourcesTab } from "./AgentSourcesTab"
import { type AgentSubAgentFormValue, AgentSubAgentsTab } from "./AgentSubAgentsTab"
import { type AgentFormData, getDefaultFormValues } from "./agent-form.shared"

const EMPTY_SUB_AGENTS: AgentSubAgentFormValue[] = []

type ActiveTab =
  | "general"
  | "model"
  | "output"
  | "sources"
  | "categories"
  | "orchestration"
  | "embed"

export function BaseAgentForm({
  editableAgent,
  onSubmit,
  agentType,
  availableAgents = [],
  subAgents = EMPTY_SUB_AGENTS,
  onSubAgentsSubmit,
  defaultActiveTab = "general",
}: {
  agentType: Agent["type"]
  editableAgent?: Agent
  availableAgents?: Agent[]
  subAgents?: AgentSubAgentFormValue[]
  onSubAgentsSubmit?: (value: AgentSubAgentFormValue[]) => Promise<void> | void
  defaultActiveTab?: ActiveTab
  onSubmit: (values: AgentFormData) => Promise<void> | void
}) {
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const { t, i18n } = useTranslation()

  const hasOutputJsonSchema = agentType !== "conversation"
  const hasSources = agentType === "conversation"
  const hasAgentSessionCategories =
    agentType === "conversation" && project.agentSessionCategories.length > 0

  const agentSchema = editableAgent ? updateAgentSchema : createAgentSchema
  type FormValues = z.infer<typeof agentSchema>

  const defaultValues = (function buildDefaultValues() {
    if (editableAgent) {
      return {
        ...editableAgent,
        tagsToAdd: [],
        tagsToRemove: [],
      } as FormValues
    }

    const language = i18n.language.startsWith("fr") ? AgentLocale.FR : AgentLocale.EN
    return {
      ...getDefaultFormValues({ agentType, language }),
      projectAgentSessionCategoryIds: project.agentSessionCategories.map((category) => category.id),
    }
  })()

  const methods = useForm<FormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues,
  })
  const { handleSubmit, reset: resetAgentForm } = methods

  const {
    control: subAgentsControl,
    handleSubmit: handleSubAgentsFormSubmit,
    reset: resetSubAgentsForm,
  } = useForm<{ subAgents: AgentSubAgentFormValue[] }>({
    defaultValues: { subAgents },
  })

  useEffect(() => {
    resetSubAgentsForm({ subAgents })
  }, [resetSubAgentsForm, subAgents])

  const hasEmbed = hasSources && !!editableAgent && hasFeature("agent-embed")
  const hasOrchestration =
    hasSources && !!editableAgent && hasFeature("agent-orchestration") && !!onSubAgentsSubmit

  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultActiveTab)

  const handleFormSubmit = async (data: FormValues) => {
    await onSubmit(data as AgentFormData)
    resetAgentForm(data)
  }

  const handleOrchestrationSubmit = handleSubAgentsFormSubmit(async (data) => {
    onSubAgentsSubmit?.(data.subAgents)
    resetSubAgentsForm(data)
  })

  const handleInvalidSubmit = (formErrors: FieldErrors<FormValues>) => {
    const firstErrorTab = pickTabForErrors(formErrors as Record<string, unknown>)
    if (firstErrorTab && firstErrorTab !== activeTab) {
      setActiveTab(firstErrorTab)
    }
  }

  return (
    <FormProvider {...(methods as UseFormReturn<AgentFormData>)}>
      <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)}>
        <FieldGroup>
          <FieldSet>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
              <TabsList>
                <TabsTrigger value="general">{t("agent:tabs.general")}</TabsTrigger>
                <TabsTrigger value="model">{t("agent:tabs.model")}</TabsTrigger>
                {hasOutputJsonSchema && (
                  <TabsTrigger value="output">
                    {agentType === "form" ? t("agent:tabs.form") : t("agent:tabs.output")}
                  </TabsTrigger>
                )}
                {hasSources && <TabsTrigger value="sources">{t("agent:tabs.sources")}</TabsTrigger>}
                {hasAgentSessionCategories && (
                  <TabsTrigger value="categories">{t("agent:tabs.categories")}</TabsTrigger>
                )}
                {hasOrchestration && (
                  <TabsTrigger value="orchestration">{t("agent:tabs.orchestration")}</TabsTrigger>
                )}
                {hasEmbed && <TabsTrigger value="embed">{t("agent:tabs.embed")}</TabsTrigger>}
              </TabsList>

              <TabsContent value="general">
                <AgentGeneralTab />
              </TabsContent>

              <TabsContent value="model">
                <AgentModelTab />
              </TabsContent>

              {hasOutputJsonSchema && (
                <TabsContent value="output">
                  <AgentOutputTab />
                </TabsContent>
              )}

              {hasSources && (
                <TabsContent value="sources">
                  <AgentSourcesTab />
                </TabsContent>
              )}

              {hasAgentSessionCategories && (
                <TabsContent value="categories">
                  <AgentSessionCategoriesTab />
                </TabsContent>
              )}

              {hasEmbed && editableAgent && (
                <TabsContent value="embed">
                  <AgentEmbedTab />
                </TabsContent>
              )}

              {hasOrchestration && editableAgent && (
                <TabsContent value="orchestration">
                  <Controller
                    control={subAgentsControl}
                    name="subAgents"
                    render={({ field }) => (
                      <AgentSubAgentsTab
                        parentAgentId={editableAgent.id}
                        agents={availableAgents}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </TabsContent>
              )}
            </Tabs>

            {activeTab === "orchestration" && hasOrchestration && (
              <Field orientation="horizontal" className="justify-end">
                <Button type="button" className="w-fit" onClick={handleOrchestrationSubmit}>
                  {t("actions:update")}
                </Button>
              </Field>
            )}

            {activeTab !== "embed" && activeTab !== "orchestration" && (
              <Field orientation="horizontal" className="justify-end">
                <Button type="submit" className="w-fit">
                  {editableAgent ? t("actions:update") : t("actions:create")}
                </Button>
              </Field>
            )}
          </FieldSet>
        </FieldGroup>
      </form>
    </FormProvider>
  )
}

const FIELD_TO_TAB: Record<string, "general" | "model" | "output" | "sources" | "categories"> = {
  name: "general",
  locale: "general",
  defaultPrompt: "general",
  greetingMessage: "general",
  projectAgentSessionCategoryIds: "categories",
  model: "model",
  temperature: "model",
  outputJsonSchema: "output",
  documentsRagMode: "sources",
  documentTagIds: "sources",
  tagsToAdd: "sources",
  tagsToRemove: "sources",
}

function pickTabForErrors(
  errors: Record<string, unknown>,
): "general" | "model" | "output" | "sources" | "categories" | null {
  for (const tab of ["general", "model", "output", "sources", "categories"] as const) {
    const hasErrorOnTab = Object.keys(errors).some((field) => FIELD_TO_TAB[field] === tab)
    if (hasErrorOnTab) return tab
  }
  return null
}

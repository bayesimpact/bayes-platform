import {
  AgentLocale,
  AgentModel,
  AgentModelToAgentProvider,
  AgentProvider,
  createAgentSchema,
  DocumentsRagMode,
  outputJsonSchemaSchema,
  updateAgentSchema,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/ui/shad/tabs"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, type FieldErrors, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import type { Agent } from "@/common/features/agents/agents.models"
import type { ProjectAgentCategory } from "@/common/features/projects/projects.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { type HasFeature, useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { AgentEmbedTab } from "@/studio/features/agent-embed-configs/components/AgentEmbedTab"
import { getTagNameById } from "@/studio/features/document-tags/document-tags.helpers"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import { type AgentSubAgentFormValue, AgentSubAgentsTab } from "./AgentSubAgentsTab"
import { type AgentFormData, getDefaultFormValues } from "./agent-form.shared"

const EMPTY_SUB_AGENTS: AgentSubAgentFormValue[] = []

function extractModelListFromAgentType(
  _agentType: "conversation" | "extraction" | "form",
  hasFeature: HasFeature,
) {
  const defaultModels = Object.entries(AgentModel).filter(
    ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Vertex,
  )
  let medGemmaModels: [string, AgentModel][] = []
  let gemmaModels: [string, AgentModel][] = []
  if (hasFeature("gemma")) {
    gemmaModels = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.Gemma,
    )
  }
  if (hasFeature("medgemma")) {
    medGemmaModels = Object.entries(AgentModel).filter(
      ([_key, value]) => AgentModelToAgentProvider[value] === AgentProvider.MedGemma,
    )
  }
  return [...defaultModels, ...medGemmaModels, ...gemmaModels]
}

export function BaseAgentForm({
  editableAgent,
  onSubmit,
  agentType,
  documentTags,
  projectAgentCategories,
  availableAgents = [],
  subAgents = EMPTY_SUB_AGENTS,
  onSubAgentsSubmit,
  defaultActiveTab = "general",
}: {
  documentTags: DocumentTag[]
  projectAgentCategories: ProjectAgentCategory[]
  agentType: Agent["type"]
  editableAgent?: Agent
  availableAgents?: Agent[]
  subAgents?: AgentSubAgentFormValue[]
  onSubAgentsSubmit?: (value: AgentSubAgentFormValue[]) => Promise<void> | void
  defaultActiveTab?: "general" | "model" | "output" | "sources" | "orchestration" | "embed"
  onSubmit: (values: AgentFormData) => Promise<void> | void
}) {
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const { t, i18n } = useTranslation()

  const hasOutputJsonSchema = agentType !== "conversation"
  const hasSources = agentType === "conversation"
  const hasGreetingMessage = agentType === "conversation" || agentType === "form"
  const hasAgentCategories = agentType === "conversation" && projectAgentCategories.length > 0

  const agentSchema = editableAgent ? updateAgentSchema : createAgentSchema
  type FormValues = z.infer<typeof agentSchema>

  const defaultValues = (function buildDefaultValues() {
    if (editableAgent) {
      // Edition
      return {
        ...editableAgent,
        tagsToAdd: [],
        tagsToRemove: [],
      } as FormValues
    }

    // Creation
    const language = i18n.language.startsWith("fr") ? AgentLocale.FR : AgentLocale.EN
    return getDefaultFormValues({ agentType, language })
  })()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset: resetAgentForm,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues,
  })

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
  const documentsRagMode = watch("documentsRagMode")
  const documentTagErrorMessage = (() => {
    if (editableAgent && "documentTagIds" in errors) {
      return errors.documentTagIds?.message
    }
    if (!editableAgent && "tagsToAdd" in errors) {
      return errors.tagsToAdd?.message
    }
    return undefined
  })()

  const hasEmbed = hasSources && !!editableAgent && hasFeature("agent-embed")
  const hasOrchestration =
    hasSources && !!editableAgent && hasFeature("agent-orchestration") && !!onSubAgentsSubmit

  const [activeTab, setActiveTab] = useState<
    "general" | "model" | "output" | "sources" | "orchestration" | "embed"
  >(defaultActiveTab)

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
    <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)}>
      <FieldGroup>
        <FieldSet>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          >
            <TabsList>
              <TabsTrigger value="general">{t("agent:tabs.general")}</TabsTrigger>
              <TabsTrigger value="model">{t("agent:tabs.model")}</TabsTrigger>
              {hasOutputJsonSchema && (
                <TabsTrigger value="output">
                  {agentType === "form" ? t("agent:tabs.form") : t("agent:tabs.output")}
                </TabsTrigger>
              )}
              {hasSources && <TabsTrigger value="sources">{t("agent:tabs.sources")}</TabsTrigger>}
              {hasOrchestration && (
                <TabsTrigger value="orchestration">{t("agent:tabs.orchestration")}</TabsTrigger>
              )}
              {hasEmbed && <TabsTrigger value="embed">{t("agent:tabs.embed")}</TabsTrigger>}
            </TabsList>

            <TabsContent value="general">
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="name">{t("agent:props.name")}</FieldLabel>
                    <Input
                      id="name"
                      placeholder={t("agent:props.placeholders.name")}
                      {...register("name")}
                      aria-invalid={errors.name ? "true" : "false"}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="locale">{t("agent:props.locale")}</FieldLabel>
                    <Controller
                      control={control}
                      name="locale"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger
                            id="locale"
                            aria-invalid={errors.locale ? "true" : "false"}
                          >
                            <SelectValue placeholder={t("agent:props.placeholders.locale")} />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(AgentLocale).map(([key, value]) => (
                              <SelectItem key={key} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.locale && (
                      <p className="text-sm text-destructive">{errors.locale.message}</p>
                    )}
                  </Field>
                </div>

                {hasGreetingMessage && (
                  <Field>
                    <FieldLabel htmlFor="greetingMessage">{t("agent:props.greeting")}</FieldLabel>
                    <Textarea
                      id="greetingMessage"
                      placeholder={t("agent:props.placeholders.greeting")}
                      rows={3}
                      className="min-h-40 max-h-96 font-mono"
                      {...register("greetingMessage", {
                        setValueAs: (value: string | null | undefined) => {
                          if (value === null || value === undefined) return null
                          const trimmed = value.trim()
                          return trimmed.length === 0 ? null : value
                        },
                      })}
                      aria-invalid={errors.greetingMessage ? "true" : "false"}
                    />
                    {errors.greetingMessage && (
                      <p className="text-sm text-destructive">{errors.greetingMessage.message}</p>
                    )}
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="defaultPrompt">{t("agent:props.defaultPrompt")}</FieldLabel>
                  <Textarea
                    id="defaultPrompt"
                    placeholder={t("agent:props.placeholders.defaultPrompt")}
                    rows={8}
                    className="min-h-40 max-h-96 font-mono"
                    {...register("defaultPrompt")}
                    aria-invalid={errors.defaultPrompt ? "true" : "false"}
                  />
                  {errors.defaultPrompt && (
                    <p className="text-sm text-destructive">{errors.defaultPrompt.message}</p>
                  )}
                </Field>

                {hasAgentCategories && (
                  <Field>
                    <FieldLabel>{t("agent:props.agentCategories")}</FieldLabel>
                    <Controller
                      control={control}
                      name="projectAgentCategoryIds"
                      render={({ field }) => (
                        <FieldGroup data-slot="checkbox-group">
                          {projectAgentCategories.map((projectAgentCategory) => {
                            const isChecked = field.value.includes(projectAgentCategory.id)
                            const isDisabled =
                              editableAgent?.usedProjectAgentCategoryIds.includes(
                                projectAgentCategory.id,
                              ) ?? false
                            const checkboxId = `agent-category-${projectAgentCategory.id}`
                            return (
                              <Field
                                key={projectAgentCategory.id}
                                orientation="horizontal"
                                data-disabled={isDisabled ? true : undefined}
                              >
                                <Checkbox
                                  id={checkboxId}
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, projectAgentCategory.id])
                                      return
                                    }
                                    field.onChange(
                                      field.value.filter(
                                        (categoryId) => categoryId !== projectAgentCategory.id,
                                      ),
                                    )
                                  }}
                                />
                                <FieldLabel htmlFor={checkboxId}>
                                  {projectAgentCategory.name}
                                </FieldLabel>
                              </Field>
                            )
                          })}
                        </FieldGroup>
                      )}
                    />
                    <FieldDescription>{t("agent:props.agentCategoriesInUse")}</FieldDescription>
                  </Field>
                )}
              </FieldGroup>
            </TabsContent>

            <TabsContent value="model">
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="model">{t("agent:props.model")}</FieldLabel>
                    <Controller
                      control={control}
                      name="model"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger id="model" aria-invalid={errors.model ? "true" : "false"}>
                            <SelectValue placeholder={t("agent:props.placeholders.model")} />
                          </SelectTrigger>
                          <SelectContent>
                            {extractModelListFromAgentType(agentType, hasFeature).map(
                              ([key, value]) => (
                                <SelectItem key={key} value={value}>
                                  {value}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.model && (
                      <p className="text-sm text-destructive">{errors.model.message}</p>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="temperature">{t("agent:props.temperature")}</FieldLabel>
                    <Input
                      id="temperature"
                      type="number"
                      step="0.01"
                      min="0"
                      max="2"
                      placeholder={t("agent:props.placeholders.temperature")}
                      {...register("temperature", { valueAsNumber: true })}
                      aria-invalid={errors.temperature ? "true" : "false"}
                    />
                    {errors.temperature && (
                      <p className="text-sm text-destructive">{errors.temperature.message}</p>
                    )}
                  </Field>
                </div>
              </FieldGroup>
            </TabsContent>

            {hasOutputJsonSchema && (
              <TabsContent value="output">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="outputJsonSchema">
                      {agentType === "form"
                        ? t("agent:props.formConfiguration")
                        : t("agent:props.outputJsonSchema")}
                    </FieldLabel>
                    <Controller
                      control={control}
                      name="outputJsonSchema"
                      render={({ field }) => (
                        <Textarea
                          id="outputJsonSchema"
                          placeholder={t("agent:props.placeholders.outputJsonSchema")}
                          rows={10}
                          className="font-mono min-h-56"
                          defaultValue={!field.value ? "" : JSON.stringify(field.value, null, 2)}
                          onChange={async (e) => {
                            const raw = e.target.value
                            try {
                              const parsed = JSON.parse(raw)
                              const validationResult = outputJsonSchemaSchema.safeParse(parsed)
                              if (validationResult.success) {
                                field.onChange(parsed)
                              } else {
                                // @ts-expect-error - We know there is at least one error because validation failed
                                const firstError = validationResult.error.errors[0]
                                field.onChange(raw, {
                                  errors: [{ message: firstError.message }],
                                })
                              }
                            } catch {
                              field.onChange(raw, { errors: [{ message: "Invalid JSON" }] })
                            }
                          }}
                          aria-invalid={errors.outputJsonSchema ? "true" : "false"}
                        />
                      )}
                    />
                    {errors.outputJsonSchema && (
                      <p className="text-sm text-destructive">{errors.outputJsonSchema.message}</p>
                    )}
                  </Field>
                </FieldGroup>
              </TabsContent>
            )}

            {hasSources && (
              <TabsContent value="sources">
                <FieldGroup>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="documentsRagMode">
                        {t("agent:props.documentsRagMode")}
                      </FieldLabel>
                      <Controller
                        control={control}
                        name="documentsRagMode"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger
                              id="documentsRagMode"
                              aria-invalid={errors.documentsRagMode ? "true" : "false"}
                            >
                              <SelectValue
                                placeholder={t("agent:props.placeholders.documentsRagMode")}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={DocumentsRagMode.None}>
                                {t("agent:props.documentsRagModeOptions.none")}
                              </SelectItem>
                              <SelectItem value={DocumentsRagMode.All}>
                                {t("agent:props.documentsRagModeOptions.all")}
                              </SelectItem>
                              <SelectItem value={DocumentsRagMode.Tags}>
                                {t("agent:props.documentsRagModeOptions.tags")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.documentsRagMode && (
                        <p className="text-sm text-destructive">
                          {errors.documentsRagMode.message}
                        </p>
                      )}
                    </Field>
                  </div>

                  {documentsRagMode === DocumentsRagMode.Tags && documentTags.length > 0 && (
                    <Field>
                      <FieldLabel>{t("agent:props.documentTags")}</FieldLabel>
                      <Controller
                        control={control}
                        name={
                          "documentTagIds" in agentSchema.shape ? "documentTagIds" : "tagsToAdd"
                        }
                        render={({ field }) => {
                          return (
                            <div className="flex flex-wrap gap-2 items-center">
                              {field.value.map((tagId) => (
                                <Badge key={tagId} variant="secondary" className="gap-1">
                                  {getTagNameById(documentTags, tagId)}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      field.onChange(field.value.filter((id) => id !== tagId))
                                    }
                                    className="opacity-60 hover:opacity-100"
                                  >
                                    <XIcon className="size-3" />
                                  </button>
                                </Badge>
                              ))}
                              <DocumentTagPicker
                                documentTags={documentTags}
                                attachedTagIds={field.value}
                                onAdd={(tagId) => field.onChange([...field.value, tagId])}
                              />
                            </div>
                          )
                        }}
                      />
                      {documentTagErrorMessage && (
                        <p className="text-sm text-destructive">{documentTagErrorMessage}</p>
                      )}
                    </Field>
                  )}
                </FieldGroup>
              </TabsContent>
            )}
            {hasEmbed && editableAgent && (
              <TabsContent value="embed">
                <AgentEmbedTab agent={editableAgent} />
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
  )
}

const FIELD_TO_TAB: Record<string, "general" | "model" | "output" | "sources"> = {
  name: "general",
  locale: "general",
  defaultPrompt: "general",
  greetingMessage: "general",
  projectAgentCategoryIds: "general",
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
): "general" | "model" | "output" | "sources" | null {
  for (const tab of ["general", "model", "output", "sources"] as const) {
    const hasErrorOnTab = Object.keys(errors).some((field) => FIELD_TO_TAB[field] === tab)
    if (hasErrorOnTab) return tab
  }
  return null
}

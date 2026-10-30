import {
  DocumentsRagMode,
  getEmbeddingModelMetadata,
  PUBLIC_DOCUMENTS_TAG_NAME,
  type UpdateAgentSettingsSourcesFormDto,
  updateAgentSettingsSourcesFormSchema,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLinkIcon, XIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { updateAgentSettingsSources } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { useDocumentTags } from "@/studio/features/document-tags/document-tags.helpers"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import { ResourceLibraryPicker } from "@/studio/features/resource-libraries/components/ResourceLibraryPicker"
import {
  getResourceLibraryTitleById,
  useResourceLibraries,
} from "@/studio/features/resource-libraries/resource-libraries.helpers"
import { StudioRoutes } from "@/studio/routes/helpers"
import { type AgentTabFormProps, useReportDirty } from "../agent-tab-form.shared"
import { AgentTabLink } from "./AgentTabLink"
import { AgentTabSectionHeader } from "./AgentTabSectionHeader"
import { TabSaveButton } from "./TabSaveButton"

function DocumentTagBadge({
  tagId,
  documentTags,
  onRemove,
}: {
  tagId: string
  documentTags: DocumentTag[]
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const tag = documentTags.find((documentTag) => documentTag.id === tagId)
  const name = tag?.name ?? "Unknown Tag"
  const description =
    tag?.name === PUBLIC_DOCUMENTS_TAG_NAME ? t("documentTag:publicDescription") : tag?.description

  const badge = (
    <Badge variant="secondary" className="gap-1">
      {name}
      <button type="button" onClick={onRemove} className="opacity-60 hover:opacity-100">
        <XIcon className="size-3" />
      </button>
    </Badge>
  )

  if (!description) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-balance">{description}</TooltipContent>
    </Tooltip>
  )
}

/**
 * What the agent answers from: the project's documents, searched with the agent's embedding
 * model (set in the Model tab), and its resource libraries.
 */
export function SourcesTab({
  agentSettings,
  onDirtyChange,
  onOpenModelTab,
}: AgentTabFormProps & { onOpenModelTab: () => void }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { documentTags } = useDocumentTags()
  const { resourceLibraries } = useResourceLibraries()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const resourceLibrariesPath = StudioRoutes.resourceLibraries.build({ organizationId, projectId })
  const embeddingModelLabel =
    getEmbeddingModelMetadata(agentSettings.embeddingModel)?.label ?? agentSettings.embeddingModel

  const form = useForm<UpdateAgentSettingsSourcesFormDto>({
    resolver: zodResolver(updateAgentSettingsSourcesFormSchema),
    defaultValues: {
      documentsRagMode: agentSettings.documentsRagMode,
      documentTagIds: agentSettings.documentTagIds,
      resourceLibraryIds: agentSettings.resourceLibraryIds,
    },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  // useWatch (not watch) so this component re-renders on changes — the React Compiler memoizes
  // children, so a form-root re-render would not otherwise reach the conditional tag field.
  const documentsRagMode = useWatch({ control: form.control, name: "documentsRagMode" })

  const handleSubmit = form.handleSubmit(async (values) => {
    const originalTagIds = agentSettings.documentTagIds
    const tagsToAdd = values.documentTagIds.filter((id) => !originalTagIds.includes(id))
    const tagsToRemove = originalTagIds.filter((id) => !values.documentTagIds.includes(id))
    await dispatch(
      updateAgentSettingsSources({
        agentId: agentSettings.agentId,
        fields: { ...values, tagsToAdd, tagsToRemove },
      }),
    ).unwrap()
    form.reset(values)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="space-y-4 rounded-lg border p-4">
          <AgentTabSectionHeader
            title={t("agentSettings:sources.documents.title")}
            description={t("agentSettings:sources.documents.description")}
            action={
              documentsRagMode !== DocumentsRagMode.None && (
                <RestrictedFeature feature="embedding-models">
                  <AgentTabLink onClick={onOpenModelTab}>
                    {t("agentSettings:sources.documents.embeddingModel", {
                      model: embeddingModelLabel,
                    })}
                  </AgentTabLink>
                </RestrictedFeature>
              )
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="documentsRagMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("agentSettings:props.documentsRagMode")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("agentSettings:props.placeholders.documentsRagMode")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={DocumentsRagMode.None}>
                        {t("agentSettings:props.documentsRagModeOptions.none")}
                      </SelectItem>
                      <SelectItem value={DocumentsRagMode.All}>
                        {t("agentSettings:props.documentsRagModeOptions.all")}
                      </SelectItem>
                      {(documentTags.length > 0 || field.value === DocumentsRagMode.Tags) && (
                        <SelectItem value={DocumentsRagMode.Tags}>
                          {t("agentSettings:props.documentsRagModeOptions.tags")}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {documentsRagMode === DocumentsRagMode.Tags && documentTags.length > 0 && (
            <FormField
              control={form.control}
              name="documentTagIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("agentSettings:props.documentTags")}</FormLabel>
                  <div className="flex flex-wrap gap-2 items-center">
                    {field.value.map((tagId) => (
                      <DocumentTagBadge
                        key={tagId}
                        tagId={tagId}
                        documentTags={documentTags}
                        onRemove={() => field.onChange(field.value.filter((id) => id !== tagId))}
                      />
                    ))}
                    <DocumentTagPicker
                      documentTags={documentTags}
                      attachedTagIds={field.value}
                      onAdd={(tagId) => field.onChange([...field.value, tagId])}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </section>

        <section className="space-y-4 rounded-lg border p-4">
          <FormField
            control={form.control}
            name="resourceLibraryIds"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t("resourceLibrary:agentTab.label")}</FormLabel>
                  <Link
                    to={resourceLibrariesPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t("resourceLibrary:manage")}
                    <ExternalLinkIcon className="size-3.5" />
                  </Link>
                </div>
                <FormDescription>{t("resourceLibrary:agentTab.description")}</FormDescription>
                <FormControl>
                  <div className="flex flex-wrap items-center gap-2">
                    {field.value.map((libraryId) => (
                      <Badge key={libraryId} variant="secondary" className="gap-1">
                        {getResourceLibraryTitleById(resourceLibraries, libraryId)}
                        <button
                          type="button"
                          onClick={() =>
                            field.onChange(field.value.filter((id) => id !== libraryId))
                          }
                          className="opacity-60 hover:opacity-100"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    <ResourceLibraryPicker
                      resourceLibraries={resourceLibraries}
                      attachedLibraryIds={field.value}
                      onAdd={(libraryId) => field.onChange([...field.value, libraryId])}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <TabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
          onCancel={() => form.reset()}
        />
      </form>
    </Form>
  )
}

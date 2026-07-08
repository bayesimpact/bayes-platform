import {
  DocumentsRagMode,
  PUBLIC_DOCUMENTS_TAG_NAME,
  type UpdateAgentSourcesFormDto,
  updateAgentSourcesFormSchema,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Form,
  FormControl,
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
import { XIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import { useDocumentTags } from "@/studio/features/document-tags/document-tags.helpers"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import { updateAgentSources } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, useReportDirty } from "./agent-tab-form.shared"

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

export function AgentSourcesTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { documentTags } = useDocumentTags()

  const form = useForm<UpdateAgentSourcesFormDto>({
    resolver: zodResolver(updateAgentSourcesFormSchema),
    defaultValues: {
      documentsRagMode: agent.documentsRagMode,
      documentTagIds: agent.documentTagIds,
    },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  // useWatch (not watch) so this component re-renders on changes — the React Compiler memoizes
  // children, so a form-root re-render would not otherwise reach the conditional tag field.
  const documentsRagMode = useWatch({ control: form.control, name: "documentsRagMode" })

  const handleSubmit = form.handleSubmit(async (values) => {
    const originalTagIds = agent.documentTagIds
    const tagsToAdd = values.documentTagIds.filter((id) => !originalTagIds.includes(id))
    const tagsToRemove = originalTagIds.filter((id) => !values.documentTagIds.includes(id))
    await dispatch(
      updateAgentSources({
        agentId: agent.id,
        fields: { ...values, tagsToAdd, tagsToRemove },
      }),
    ).unwrap()
    form.reset(values)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="documentsRagMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agent:props.documentsRagMode")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("agent:props.placeholders.documentsRagMode")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={DocumentsRagMode.None}>
                      {t("agent:props.documentsRagModeOptions.none")}
                    </SelectItem>
                    <SelectItem value={DocumentsRagMode.All}>
                      {t("agent:props.documentsRagModeOptions.all")}
                    </SelectItem>
                    {(documentTags.length > 0 || field.value === DocumentsRagMode.Tags) && (
                      <SelectItem value={DocumentsRagMode.Tags}>
                        {t("agent:props.documentsRagModeOptions.tags")}
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
                <FormLabel>{t("agent:props.documentTags")}</FormLabel>
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

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
        />
      </form>
    </Form>
  )
}

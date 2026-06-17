import {
  DocumentsRagMode,
  PUBLIC_DOCUMENTS_TAG_NAME,
  type UpdateAgentDto,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { XIcon } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { useDocumentTags } from "@/studio/features/document-tags/document-tags.helpers"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import type { AgentFormValues } from "./agent-form.shared"

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

export function AgentSourcesTab() {
  const { t } = useTranslation()
  const {
    control,
    formState: { errors },
  } = useFormContext<AgentFormValues>()

  const { documentTags } = useDocumentTags()
  const agentData = useAppSelector(selectCurrentAgentData)
  const editableAgent = ADS.isFulfilled(agentData) ? agentData.value : undefined

  // useWatch (not watch) so this child component re-renders on changes:
  // watch() only notifies the form root, and the React Compiler memoizes
  // this tab so the root re-render never reaches it.
  const documentsRagMode = useWatch({ control, name: "documentsRagMode" })

  const documentTagErrorMessage = (() => {
    if (editableAgent && "documentTagIds" in errors) {
      return errors.documentTagIds?.message
    }
    if (!editableAgent && "tagsToAdd" in errors) {
      return errors.tagsToAdd?.message
    }
    return undefined
  })()

  return (
    <FieldGroup>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="documentsRagMode">{t("agent:props.documentsRagMode")}</FieldLabel>
          <Controller
            control={control}
            name="documentsRagMode"
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger
                  id="documentsRagMode"
                  aria-invalid={errors.documentsRagMode ? "true" : "false"}
                >
                  <SelectValue placeholder={t("agent:props.placeholders.documentsRagMode")} />
                </SelectTrigger>
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
            )}
          />
          {errors.documentsRagMode && (
            <p className="text-sm text-destructive">{errors.documentsRagMode.message}</p>
          )}
        </Field>
      </div>

      {documentsRagMode === DocumentsRagMode.Tags && documentTags.length > 0 && (
        <Field>
          <FieldLabel>{t("agent:props.documentTags")}</FieldLabel>
          {editableAgent ? (
            <Controller
              control={control as unknown as import("react-hook-form").Control<UpdateAgentDto>}
              name="documentTagIds"
              render={({ field }) => (
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
              )}
            />
          ) : (
            <Controller
              control={control}
              name="tagsToAdd"
              render={({ field }) => (
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
              )}
            />
          )}
          {documentTagErrorMessage && (
            <p className="text-sm text-destructive">{documentTagErrorMessage}</p>
          )}
        </Field>
      )}
    </FieldGroup>
  )
}

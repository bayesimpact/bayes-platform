import { DocumentsRagMode, type UpdateAgentDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { XIcon } from "lucide-react"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { getTagNameById } from "@/studio/features/document-tags/document-tags.helpers"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import type { AgentFormValues } from "./agent-form.shared"

export function AgentSourcesTab({
  documentTags,
  editableAgent,
}: {
  documentTags: DocumentTag[]
  editableAgent?: Agent
}) {
  const { t } = useTranslation()
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<AgentFormValues>()

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
                  <SelectItem value={DocumentsRagMode.Tags}>
                    {t("agent:props.documentsRagModeOptions.tags")}
                  </SelectItem>
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
                    <Badge key={tagId} variant="secondary" className="gap-1">
                      {getTagNameById(documentTags, tagId)}
                      <button
                        type="button"
                        onClick={() => field.onChange(field.value.filter((id) => id !== tagId))}
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
              )}
            />
          ) : (
            <Controller
              control={control}
              name="tagsToAdd"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2 items-center">
                  {field.value.map((tagId) => (
                    <Badge key={tagId} variant="secondary" className="gap-1">
                      {getTagNameById(documentTags, tagId)}
                      <button
                        type="button"
                        onClick={() => field.onChange(field.value.filter((id) => id !== tagId))}
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

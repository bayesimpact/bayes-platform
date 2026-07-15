import { Badge } from "@caseai-connect/ui/shad/badge"
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
import { XIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import {
  getTagNameById,
  useDocumentTags,
} from "@/studio/features/document-tags/document-tags.helpers"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import type { Document } from "@/studio/features/documents/documents.models"
import { updateDocument } from "@/studio/features/documents/documents.thunks"

type FormValues = { title: string; tagIds: string[] }

export function DocumentEditForm({
  document,
  onSuccess,
}: {
  document: Document
  onSuccess: () => void
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { documentTags } = useDocumentTags()

  const form = useForm<FormValues>({
    defaultValues: { title: document.title, tagIds: document.tagIds },
  })
  const { control, handleSubmit, watch, setValue, formState } = form
  const tagIds = watch("tagIds")

  const handleFormSubmit = (values: FormValues) => {
    const originalTagIds = document.tagIds
    const tagsToAdd = values.tagIds.filter((tagId) => !originalTagIds.includes(tagId))
    const tagsToRemove = originalTagIds.filter((tagId) => !values.tagIds.includes(tagId))
    dispatch(
      updateDocument({
        documentId: document.id,
        fields: { title: values.title, tagsToAdd, tagsToRemove },
        onSuccess,
      }),
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
        <FormField
          control={control}
          name="title"
          rules={{ required: t("document:update.titleRequired") }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("document:props.title")}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2">
          <FormLabel>{t("document:props.tags")}</FormLabel>
          <div className="flex flex-wrap gap-2 items-center">
            {tagIds.map((tagId) => (
              <Badge key={tagId} variant="secondary" className="gap-1">
                {getTagNameById(documentTags, tagId)}
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      "tagIds",
                      tagIds.filter((id) => id !== tagId),
                      { shouldDirty: true },
                    )
                  }
                  className="opacity-60 hover:opacity-100"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
            <DocumentTagPicker
              documentTags={documentTags}
              attachedTagIds={tagIds}
              onAdd={(tagId) => setValue("tagIds", [...tagIds, tagId], { shouldDirty: true })}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
            {t("actions:update")}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export function DocumentMetaField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  )
}

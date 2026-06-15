import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@caseai-connect/ui/shad/command"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDownIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { generateId } from "@/common/utils/generate-id"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"

const buildSchema = (reservedNameError: string) =>
  z.object({
    name: z
      .string()
      .min(2)
      .refine((name) => name !== PUBLIC_DOCUMENTS_TAG_NAME, { message: reservedNameError }),
    description: z.string(),
    parentId: z.string().nullable(),
  })

type DocumentTagFormData = z.infer<ReturnType<typeof buildSchema>>

export function DocumentTagForm({
  allTags,
  editableTag,
  onSubmit,
}: {
  allTags: DocumentTag[]
  editableTag?: DocumentTag
  onSubmit: (
    data: Pick<DocumentTag, "name"> & Pick<DocumentTag, "description" | "parentId">,
  ) => Promise<void> | void
}) {
  const { t } = useTranslation("documentTag")
  const schema = buildSchema(t("props.validation.reservedName"))
  const [parentPickerOpen, setParentPickerOpen] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DocumentTagFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editableTag?.name ?? "",
      description: editableTag?.description ?? "",
      parentId: editableTag?.parentId ?? null,
    },
  })

  const availableParents = allTags.filter(
    // Exclude the current tag and its descendants from the list of available parents to prevent circular references
    (tag) => tag.id !== editableTag?.id && !editableTag?.childrenIds.includes(tag.id),
  )

  const handleFormSubmit = (data: DocumentTagFormData) => {
    onSubmit({
      name: data.name,
      description: data.description,
      parentId: data.parentId ?? undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <FieldGroup>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="tag-name">{t("props.name")}</FieldLabel>
              <Input
                id="tag-name"
                placeholder={t("props.placeholders.name")}
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tag-description">{t("props.description")}</FieldLabel>
              <Input
                id="tag-description"
                placeholder={t("props.placeholders.description")}
                {...register("description")}
              />
            </Field>
            {availableParents.length > 0 && (
              <Field>
                <FieldLabel>{t("props.parentTag")}</FieldLabel>
                <Controller
                  control={control}
                  name="parentId"
                  render={({ field }) => {
                    const selectedParent =
                      availableParents.find((tag) => tag.id === field.value) ?? null
                    return (
                      <div className="flex items-center gap-2">
                        <Popover open={parentPickerOpen} onOpenChange={setParentPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="gap-1">
                              {selectedParent ? selectedParent.name : t("parentNone")}
                              <ChevronDownIcon className="size-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-0" align="start">
                            <Command>
                              <CommandInput placeholder={t("searchPlaceholder")} />
                              <CommandList>
                                <CommandEmpty>{t("noTagsFound")}</CommandEmpty>
                                <CommandGroup>
                                  {availableParents.map((tag) => (
                                    <CommandItem
                                      key={tag.id}
                                      value={tag.name}
                                      onSelect={() => {
                                        field.onChange(tag.id)
                                        setParentPickerOpen(false)
                                      }}
                                    >
                                      {tag.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedParent && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => field.onChange(null)}
                          >
                            <XIcon className="size-3" />
                          </Button>
                        )}
                      </div>
                    )
                  }}
                />
              </Field>
            )}

            {/* // FIXME: */}
            {Object.keys(errors).length > 0 && (
              <FieldError>
                {Object.values(errors).map((error) => (
                  <p key={generateId()} className="text-sm text-destructive">
                    {error?.message}
                  </p>
                ))}
              </FieldError>
            )}

            <Field orientation="horizontal" className="justify-end">
              <Button type="submit">{t(`actions:${editableTag ? "update" : "create"}`)}</Button>
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>
    </form>
  )
}

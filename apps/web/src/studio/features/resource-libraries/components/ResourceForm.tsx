import { createResourceSchema, RESOURCE_FIELD_LIMITS } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { GridHeader } from "@/common/components/grid/Grid"
import { isValidHttpsUrl } from "../resource-libraries.helpers"
import type { Resource, ResourceFields } from "../resource-libraries.models"
import { ResourceLinkField } from "./ResourceLinkField"

type FormValues = z.infer<typeof createResourceSchema>

/**
 * Full-page form to create or edit a single resource. Validation is driven by the shared
 * `createResourceSchema` (so the client enforces exactly what the API does), extended with the
 * UI-only rules of a non-empty description and an https:// link. Per-field hints (character
 * counters) and errors are rendered through the shared `Form` components.
 */
export function ResourceForm({
  initialResource,
  headerTitle,
  submitLabel,
  onSubmit,
  onBack,
}: {
  initialResource: Resource
  headerTitle: string
  submitLabel: string
  onSubmit: (fields: ResourceFields) => unknown
  onBack: () => void
}) {
  const { t } = useTranslation()

  const resourceSchema = useMemo(
    () =>
      createResourceSchema
        .refine((resource) => resource.description.trim().length > 0, {
          path: ["description"],
          message: t("resourceLibrary:resourceForm.required"),
        })
        .refine(
          (resource) => resource.linkType !== "url" || isValidHttpsUrl((resource.url ?? "").trim()),
          { path: ["url"], message: t("resourceLibrary:link.urlInvalid") },
        ),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      title: initialResource.title,
      description: initialResource.description,
      matchingHints: initialResource.matchingHints ?? "",
      linkType: initialResource.linkType,
      url: initialResource.url,
      file: initialResource.file,
    },
  })

  const { control, handleSubmit, watch, setValue, formState } = form
  const linkErrorMessage = formState.errors.url?.message ?? formState.errors.linkType?.message

  const handleFormSubmit = async (values: FormValues) => {
    const matchingHints = values.matchingHints?.trim()
    await onSubmit({ ...values, matchingHints: matchingHints ? matchingHints : undefined })
  }

  // ResourceLinkField edits linkType/url/file together, so mirror its output back into the three
  // form fields rather than binding a single FormField to it.
  const linkResource: Resource = { ...initialResource, ...watch() }
  const handleLinkChange = (next: Resource) => {
    setValue("linkType", next.linkType, { shouldDirty: true, shouldValidate: true })
    setValue("url", next.url, { shouldDirty: true, shouldValidate: true })
    setValue("file", next.file, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className="flex flex-col">
      <GridHeader onBack={onBack} title={headerTitle} />

      <Form {...form}>
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex flex-col gap-4 bg-white p-6"
        >
          <FormField
            control={control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("resourceLibrary:resourceForm.titleLabel")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("resourceLibrary:resourceForm.titlePlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-right tabular-nums">
                  {t("resourceLibrary:resourceForm.charactersUsed", {
                    count: field.value?.length ?? 0,
                    max: RESOURCE_FIELD_LIMITS.title.max,
                  })}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("resourceLibrary:resourceForm.descriptionLabel")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("resourceLibrary:resourceForm.descriptionPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-right tabular-nums">
                  {t("resourceLibrary:resourceForm.charactersUsed", {
                    count: field.value?.length ?? 0,
                    max: RESOURCE_FIELD_LIMITS.description.max,
                  })}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="matchingHints"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("resourceLibrary:resourceForm.matchingHintsLabel")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("resourceLibrary:resourceForm.matchingHintsPlaceholder")}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription className="text-right tabular-nums">
                  {t("resourceLibrary:resourceForm.charactersUsed", {
                    count: field.value?.length ?? 0,
                    max: RESOURCE_FIELD_LIMITS.matchingHints.max,
                  })}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-1">
            <ResourceLinkField resource={linkResource} onChange={handleLinkChange} />
            {linkErrorMessage && <p className="text-destructive text-sm">{linkErrorMessage}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onBack}>
              {t("actions:cancel")}
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

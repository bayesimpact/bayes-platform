import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

/**
 * Standalone form for a resource library's title: the input and its save button sit on the same
 * row. Shared by the create page (saving creates the library) and the editor (saving renames it).
 */
export function ResourceLibraryTitleForm({
  defaultTitle,
  isLoading,
  submitLabel,
  onSubmit,
}: {
  defaultTitle: string
  isLoading: boolean
  submitLabel: string
  onSubmit: (title: string) => void
}) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ title: string }>({ defaultValues: { title: defaultTitle } })

  return (
    <form onSubmit={handleSubmit(({ title }) => onSubmit(title))}>
      <Field>
        <FieldLabel htmlFor="resource-library-title">
          {t("resourceLibrary:form.titleLabel")}
        </FieldLabel>
        <div className="flex items-start gap-2">
          <Input
            id="resource-library-title"
            className="flex-1"
            placeholder={t("resourceLibrary:form.titlePlaceholder")}
            aria-invalid={errors.title ? "true" : "false"}
            {...register("title", { required: true })}
          />
          <Button type="submit" variant="outline" disabled={isLoading}>
            {submitLabel}
          </Button>
        </div>
        {errors.title && (
          <p className="text-sm text-destructive">{t("resourceLibrary:form.titleRequired")}</p>
        )}
      </Field>
    </form>
  )
}

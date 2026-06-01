import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import type { Project } from "@/common/features/projects/projects.models"

type ProjectFormData = {
  name: string
}

export function ProjectForm({
  editableProject,
  onSubmit,
}: {
  editableProject?: Project
  onSubmit: (values: ProjectFormData) => Promise<void> | void
}) {
  const { t } = useTranslation()

  const projectSchema = z.object({
    name: z.string().min(1, t("project:props.validation.name")),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: editableProject?.name ?? "",
    },
  })

  const handleFormSubmit = async (data: ProjectFormData) => {
    await onSubmit(data)
    reset({ name: data.name })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <FieldGroup>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">{t("project:props.name")}</FieldLabel>
              <Input
                id="name"
                placeholder={t("project:props.placeholders.name")}
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </Field>

            <Field orientation="horizontal" className="justify-end">
              <Button type="submit">
                {t(editableProject ? "actions:update" : "actions:create")}
              </Button>
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>
    </form>
  )
}

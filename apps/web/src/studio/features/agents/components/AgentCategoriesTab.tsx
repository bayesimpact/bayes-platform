import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import type { ProjectAgentCategory } from "@/common/features/projects/projects.models"
import type { AgentFormValues } from "./agent-form.shared"

export function AgentCategoriesTab({
  projectAgentCategories,
  editableAgent,
}: {
  projectAgentCategories: ProjectAgentCategory[]
  editableAgent?: Agent
}) {
  const { t } = useTranslation()
  const { control } = useFormContext<AgentFormValues>()

  return (
    <Controller
      control={control}
      name="projectAgentCategoryIds"
      render={({ field }) => (
        <FieldGroup>
          <FieldGroup data-slot="checkbox-group">
            {projectAgentCategories.map((projectAgentCategory) => {
              const isChecked = field.value.includes(projectAgentCategory.id)
              const isDisabled =
                editableAgent?.usedProjectAgentCategoryIds.includes(projectAgentCategory.id) ??
                false
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
                        field.value.filter((categoryId) => categoryId !== projectAgentCategory.id),
                      )
                    }}
                  />
                  <FieldLabel htmlFor={checkboxId}>{projectAgentCategory.name}</FieldLabel>
                </Field>
              )
            })}
          </FieldGroup>
          {projectAgentCategories.length > 1 &&
            !projectAgentCategories.every((category) => field.value.includes(category.id)) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  field.onChange(projectAgentCategories.map((category) => category.id))
                }
              >
                {t("actions:selectAll")}
              </Button>
            )}
          <FieldDescription>{t("agent:props.agentCategoriesInUse")}</FieldDescription>
        </FieldGroup>
      )}
    />
  )
}

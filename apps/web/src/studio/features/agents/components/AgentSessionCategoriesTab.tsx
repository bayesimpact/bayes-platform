import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useValue } from "@/common/hooks/use-value"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import type { AgentFormValues } from "./agent-form.shared"

export function AgentSessionCategoriesTab() {
  const { t } = useTranslation()
  const { control } = useFormContext<AgentFormValues>()

  const project = useValue(selectCurrentProjectData)
  const projectSessionCategories = project.agentSessionCategories

  const agentData = useAppSelector(selectCurrentAgentData)
  const editableAgent = ADS.isFulfilled(agentData) ? agentData.value : undefined

  return (
    <Controller
      control={control}
      name="projectSessionCategoryIds"
      render={({ field }) => (
        <FieldGroup>
          <FieldGroup data-slot="checkbox-group">
            {projectSessionCategories.map((projectSessionCategory) => {
              const isChecked = field.value.includes(projectSessionCategory.id)
              const isDisabled =
                editableAgent?.usedProjectSessionCategoryIds.includes(projectSessionCategory.id) ??
                false
              const checkboxId = `agent-session-category-${projectSessionCategory.id}`
              return (
                <Field
                  key={projectSessionCategory.id}
                  orientation="horizontal"
                  data-disabled={isDisabled ? true : undefined}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={isChecked}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        field.onChange([...field.value, projectSessionCategory.id])
                        return
                      }
                      field.onChange(
                        field.value.filter(
                          (categoryId) => categoryId !== projectSessionCategory.id,
                        ),
                      )
                    }}
                  />
                  <FieldLabel htmlFor={checkboxId}>{projectSessionCategory.name}</FieldLabel>
                </Field>
              )
            })}
          </FieldGroup>
          {projectSessionCategories.length > 1 &&
            !projectSessionCategories.every((category) => field.value.includes(category.id)) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  field.onChange(projectSessionCategories.map((category) => category.id))
                }
              >
                {t("actions:selectAll")}
              </Button>
            )}
          <FieldDescription>{t("agent:props.agentSessionCategoriesInUse")}</FieldDescription>
        </FieldGroup>
      )}
    />
  )
}

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
  const projectAgentSessionCategories = project.agentSessionCategories

  const agentData = useAppSelector(selectCurrentAgentData)
  const editableAgent = ADS.isFulfilled(agentData) ? agentData.value : undefined

  return (
    <Controller
      control={control}
      name="projectAgentSessionCategoryIds"
      render={({ field }) => (
        <FieldGroup>
          <FieldGroup data-slot="checkbox-group">
            {projectAgentSessionCategories.map((projectAgentSessionCategory) => {
              const isChecked = field.value.includes(projectAgentSessionCategory.id)
              const isDisabled =
                editableAgent?.usedProjectAgentSessionCategoryIds.includes(
                  projectAgentSessionCategory.id,
                ) ?? false
              const checkboxId = `agent-session-category-${projectAgentSessionCategory.id}`
              return (
                <Field
                  key={projectAgentSessionCategory.id}
                  orientation="horizontal"
                  data-disabled={isDisabled ? true : undefined}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={isChecked}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        field.onChange([...field.value, projectAgentSessionCategory.id])
                        return
                      }
                      field.onChange(
                        field.value.filter(
                          (categoryId) => categoryId !== projectAgentSessionCategory.id,
                        ),
                      )
                    }}
                  />
                  <FieldLabel htmlFor={checkboxId}>{projectAgentSessionCategory.name}</FieldLabel>
                </Field>
              )
            })}
          </FieldGroup>
          {projectAgentSessionCategories.length > 1 &&
            !projectAgentSessionCategories.every((category) =>
              field.value.includes(category.id),
            ) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  field.onChange(projectAgentSessionCategories.map((category) => category.id))
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

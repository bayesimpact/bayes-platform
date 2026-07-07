import {
  type UpdateAgentCategoriesDto,
  updateAgentCategoriesSchema,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { Field, FieldDescription, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@caseai-connect/ui/shad/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { updateAgentCategories } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, useReportDirty } from "./agent-tab-form.shared"

export function AgentSessionCategoriesTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const project = useValue(selectCurrentProjectData)
  const projectAgentSessionCategories = project.agentSessionCategories

  const form = useForm<UpdateAgentCategoriesDto>({
    resolver: zodResolver(updateAgentCategoriesSchema),
    defaultValues: { projectAgentSessionCategoryIds: agent.projectAgentSessionCategoryIds },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  const handleSubmit = form.handleSubmit(async (values) => {
    await dispatch(updateAgentCategories({ agentId: agent.id, fields: values })).unwrap()
    form.reset(values)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="projectAgentSessionCategoryIds"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex flex-col gap-3" data-slot="checkbox-group">
                  {projectAgentSessionCategories.map((projectAgentSessionCategory) => {
                    const isChecked = field.value.includes(projectAgentSessionCategory.id)
                    const isDisabled = agent.usedProjectAgentSessionCategoryIds.includes(
                      projectAgentSessionCategory.id,
                    )
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
                        <FieldLabel htmlFor={checkboxId}>
                          {projectAgentSessionCategory.name}
                        </FieldLabel>
                      </Field>
                    )
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {projectAgentSessionCategories.length > 1 &&
          !projectAgentSessionCategories.every((category) =>
            form.getValues("projectAgentSessionCategoryIds").includes(category.id),
          ) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                form.setValue(
                  "projectAgentSessionCategoryIds",
                  projectAgentSessionCategories.map((category) => category.id),
                  { shouldDirty: true },
                )
              }
            >
              {t("actions:selectAll")}
            </Button>
          )}

        <FieldDescription>{t("agent:props.agentSessionCategoriesInUse")}</FieldDescription>

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
        />
      </form>
    </Form>
  )
}

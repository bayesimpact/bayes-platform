import {
  type UpdateAgentSettingsCategoriesDto,
  updateAgentSettingsCategoriesSchema,
} from "@bayes-platform/api-contracts"
import { Button } from "@bayes-platform/ui/shad/button"
import { Checkbox } from "@bayes-platform/ui/shad/checkbox"
import { Field, FieldDescription, FieldLabel } from "@bayes-platform/ui/shad/field"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@bayes-platform/ui/shad/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { updateAgentSettingsCategories } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { type AgentTabFormProps, useAutosave } from "../agent-tab-form.shared"
import { LiveSettingNotice } from "../LiveSettingNotice"

export function SessionCategoriesTab({ agentSettings, saveControl }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const project = useValue(selectCurrentProjectData)
  const projectAgentSessionCategories = project.agentSessionCategories

  const form = useForm<UpdateAgentSettingsCategoriesDto>({
    resolver: zodResolver(updateAgentSettingsCategoriesSchema),
    shouldFocusError: false,
    defaultValues: { projectAgentSessionCategoryIds: agentSettings.projectAgentSessionCategoryIds },
  })
  const { onSubmit } = useAutosave({
    form,
    saveControl,
    save: async ({ values }) => {
      await dispatch(
        updateAgentSettingsCategories({ agentId: agentSettings.agentId, fields: values }),
      ).unwrap()
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <LiveSettingNotice />
        <FormField
          control={form.control}
          name="projectAgentSessionCategoryIds"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex flex-col gap-3" data-slot="checkbox-group">
                  {projectAgentSessionCategories.map((projectAgentSessionCategory) => {
                    const isChecked = field.value.includes(projectAgentSessionCategory.id)
                    const isDisabled = agentSettings.usedProjectAgentSessionCategoryIds.includes(
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

        <FieldDescription>{t("agentSettings:props.agentSessionCategoriesInUse")}</FieldDescription>
      </form>
    </Form>
  )
}

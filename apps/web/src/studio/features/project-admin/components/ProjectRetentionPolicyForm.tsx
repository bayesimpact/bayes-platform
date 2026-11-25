import { CONVERSATION_RETENTION_MAX_DAYS, updateProjectSchema } from "@bayes-platform/api-contracts"
import { Button } from "@bayes-platform/ui/shad/button"
import { FieldGroup } from "@bayes-platform/ui/shad/field"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bayes-platform/ui/shad/form"
import { Input } from "@bayes-platform/ui/shad/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import type { Project } from "@/common/features/projects/projects.models"
import { useAppDispatch } from "@/common/store/hooks"
import { updateProject } from "@/studio/features/projects/projects.thunks"

// The retention is always set: no empty value, no zero (#677).
const schema = updateProjectSchema.pick({ conversationRetentionDays: true }).required()

type FormValues = z.infer<typeof schema>

export function ProjectRetentionPolicyForm({ project }: { project: Project }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { conversationRetentionDays: project.conversationRetentionDays },
  })

  useEffect(() => {
    form.reset({ conversationRetentionDays: project.conversationRetentionDays })
  }, [project.conversationRetentionDays, form])

  const onSubmit = async (values: FormValues) => {
    await dispatch(
      updateProject({
        payload: {
          name: project.name,
          conversationRetentionDays: values.conversationRetentionDays,
        },
      }),
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="conversationRetentionDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("projectAdmin:retention.retentionLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={CONVERSATION_RETENTION_MAX_DAYS}
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === "" ? Number.NaN : Number(event.target.value),
                        )
                      }
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>{t("projectAdmin:retention.retentionHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {t("actions:save")}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </Form>
  )
}

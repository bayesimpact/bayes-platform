import { Button } from "@caseai-connect/ui/shad/button"
import { FieldGroup } from "@caseai-connect/ui/shad/field"
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
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import type { Project } from "@/common/features/projects/projects.models"
import { useAppDispatch } from "@/common/store/hooks"
import { updateProject } from "@/studio/features/projects/projects.thunks"

const schema = z.object({
  name: z.string().min(1),
  conversationRetentionDays: z.number().int().min(1).max(3650).nullable(),
})

type FormValues = z.infer<typeof schema>

export function ProjectGeneralForm({ project }: { project: Project }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project.name,
      conversationRetentionDays: project.conversationRetentionDays,
    },
  })

  useEffect(() => {
    form.reset({
      name: project.name,
      conversationRetentionDays: project.conversationRetentionDays,
    })
  }, [project.name, project.conversationRetentionDays, form])

  const onSubmit = async (values: FormValues) => {
    await dispatch(
      updateProject({
        payload: {
          name: values.name,
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("projectAdmin:general.workspaceName")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="conversationRetentionDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("projectAdmin:general.conversationRetentionLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder={t("projectAdmin:general.conversationRetentionPlaceholder")}
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === "" ? null : Number(event.target.value),
                        )
                      }
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("projectAdmin:general.conversationRetentionHelp")}
                  </FormDescription>
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

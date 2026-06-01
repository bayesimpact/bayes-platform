import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@caseai-connect/ui/shad/button"
import { FieldGroup } from "@caseai-connect/ui/shad/field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import type { Project } from "@/common/features/projects/projects.models"
import { useAppDispatch } from "@/common/store/hooks"
import { updateProject } from "@/studio/features/projects/projects.thunks"

const schema = z.object({
  name: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

export function ProjectGeneralForm({ project }: { project: Project }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: project.name },
  })

  useEffect(() => {
    form.reset({ name: project.name })
  }, [project.name, form])

  const onSubmit = async (values: FormValues) => {
    await dispatch(updateProject({ payload: { name: values.name } }))
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
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || !form.formState.isDirty}
            >
              {t("actions:save")}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </Form>
  )
}

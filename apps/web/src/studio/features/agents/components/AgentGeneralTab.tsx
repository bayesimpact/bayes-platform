import { AgentLocale, updateAgentGeneralSchema } from "@caseai-connect/api-contracts"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { useAppDispatch } from "@/common/store/hooks"
import { updateAgentGeneral } from "../agents.thunks"
import { AgentTabSaveButton } from "./AgentTabSaveButton"
import { type AgentTabFormProps, useReportDirty } from "./agent-tab-form.shared"

type FormValues = z.infer<typeof updateAgentGeneralSchema>

export function AgentGeneralTab({ agent, onDirtyChange }: AgentTabFormProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const hasGreetingMessage = agent.type === "conversation" || agent.type === "form"

  const form = useForm<FormValues>({
    resolver: zodResolver(updateAgentGeneralSchema),
    defaultValues: {
      name: agent.name,
      locale: agent.locale,
      defaultPrompt: agent.defaultPrompt,
      greetingMessage: agent.greetingMessage ?? null,
    },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  const handleSubmit = form.handleSubmit(async (values) => {
    await dispatch(updateAgentGeneral({ agentId: agent.id, fields: values })).unwrap()
    form.reset(values)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agent:props.name")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("agent:props.placeholders.name")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agent:props.locale")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("agent:props.placeholders.locale")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(AgentLocale).map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {hasGreetingMessage && (
          <FormField
            control={form.control}
            name="greetingMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("agent:props.greeting")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("agent:props.placeholders.greeting")}
                    rows={3}
                    className="min-h-40 max-h-96 font-mono"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(event.target.value === "" ? null : event.target.value)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="defaultPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("agent:props.defaultPrompt")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("agent:props.placeholders.defaultPrompt")}
                  rows={8}
                  className="min-h-40 max-h-96 font-mono"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <AgentTabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
        />
      </form>
    </Form>
  )
}

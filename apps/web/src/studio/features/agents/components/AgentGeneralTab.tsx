import { AgentLocale } from "@caseai-connect/api-contracts"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { type AgentFormValues, useAgentType } from "./agent-form.shared"

export function AgentGeneralTab() {
  const { t } = useTranslation()
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<AgentFormValues>()

  const agentType = useAgentType()
  const hasGreetingMessage = agentType === "conversation" || agentType === "form"

  return (
    <FieldGroup>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="name">{t("agent:props.name")}</FieldLabel>
          <Input
            id="name"
            placeholder={t("agent:props.placeholders.name")}
            {...register("name")}
            aria-invalid={errors.name ? "true" : "false"}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </Field>

        <Field>
          <FieldLabel htmlFor="locale">{t("agent:props.locale")}</FieldLabel>
          <Controller
            control={control}
            name="locale"
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger id="locale" aria-invalid={errors.locale ? "true" : "false"}>
                  <SelectValue placeholder={t("agent:props.placeholders.locale")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AgentLocale).map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.locale && <p className="text-sm text-destructive">{errors.locale.message}</p>}
        </Field>
      </div>

      {hasGreetingMessage && (
        <Field>
          <FieldLabel htmlFor="greetingMessage">{t("agent:props.greeting")}</FieldLabel>
          <Textarea
            id="greetingMessage"
            placeholder={t("agent:props.placeholders.greeting")}
            rows={3}
            className="min-h-40 max-h-96 font-mono"
            {...register("greetingMessage", {
              setValueAs: (value: string | null | undefined) => {
                if (value === null || value === undefined) return null
                const trimmed = value.trim()
                return trimmed.length === 0 ? null : value
              },
            })}
            aria-invalid={errors.greetingMessage ? "true" : "false"}
          />
          {errors.greetingMessage && (
            <p className="text-sm text-destructive">{errors.greetingMessage.message}</p>
          )}
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="defaultPrompt">{t("agent:props.defaultPrompt")}</FieldLabel>
        <Textarea
          id="defaultPrompt"
          placeholder={t("agent:props.placeholders.defaultPrompt")}
          rows={8}
          className="min-h-40 max-h-96 font-mono"
          {...register("defaultPrompt")}
          aria-invalid={errors.defaultPrompt ? "true" : "false"}
        />
        {errors.defaultPrompt && (
          <p className="text-sm text-destructive">{errors.defaultPrompt.message}</p>
        )}
      </Field>
    </FieldGroup>
  )
}

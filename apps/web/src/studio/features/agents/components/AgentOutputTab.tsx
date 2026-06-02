import { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"
import { Field, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { Controller, type FieldError, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import type { AgentFormValues } from "./agent-form.shared"

export function AgentOutputTab({ agentType }: { agentType: Agent["type"] }) {
  const { t } = useTranslation()
  const {
    control,
    formState: { errors },
  } = useFormContext<AgentFormValues>()
  // outputJsonSchema is an object field; cast to FieldError to access .message from top-level refine errors
  const outputJsonSchemaError = errors.outputJsonSchema as FieldError | undefined

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="outputJsonSchema">
          {agentType === "form"
            ? t("agent:props.formConfiguration")
            : t("agent:props.outputJsonSchema")}
        </FieldLabel>
        <Controller
          control={control}
          name="outputJsonSchema"
          render={({ field }) => (
            <Textarea
              id="outputJsonSchema"
              placeholder={t("agent:props.placeholders.outputJsonSchema")}
              rows={10}
              className="font-mono min-h-56"
              defaultValue={!field.value ? "" : JSON.stringify(field.value, null, 2)}
              onChange={async (e) => {
                const raw = e.target.value
                try {
                  const parsed = JSON.parse(raw)
                  const validationResult = outputJsonSchemaSchema.safeParse(parsed)
                  if (validationResult.success) {
                    field.onChange(parsed)
                  } else {
                    // @ts-expect-error - We know there is at least one error because validation failed
                    const firstError = validationResult.error.errors[0]
                    field.onChange(raw, {
                      errors: [{ message: firstError.message }],
                    })
                  }
                } catch {
                  field.onChange(raw, { errors: [{ message: "Invalid JSON" }] })
                }
              }}
              aria-invalid={outputJsonSchemaError ? "true" : "false"}
            />
          )}
        />
        {outputJsonSchemaError?.message && (
          <p className="text-sm text-destructive">{outputJsonSchemaError.message}</p>
        )}
      </Field>
    </FieldGroup>
  )
}

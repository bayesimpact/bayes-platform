import type { ConversationFormOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { formFieldsOf } from "../form-fields"

export type FormFieldsProps = {
  form: ConversationFormOutputDto
}

/** The fields of a form, in the schema's order, with the value the agent noted or a dash. */
export function FormFields({ form }: FormFieldsProps) {
  const { i18n } = useLingui()
  const fields = formFieldsOf(form, i18n)
  if (fields.length === 0) {
    return (
      <p className="text-muted-foreground">
        <Trans>Nothing noted yet.</Trans>
      </p>
    )
  }
  return (
    <dl className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
          <dd className="whitespace-pre-wrap">{field.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

import type { ConversationFormOutputDto } from "@caseai-connect/desk-contracts"
import type { I18n } from "@lingui/core"
import { fieldLabelOf, fieldTextOf } from "@/lib/field-text"
import { hasOwnKey } from "@/lib/has-own-key"

/** A field of a form as the panel shows it: its label, and its value as text, if noted. */
export type FormFieldView = {
  key: string
  label: string
  value: string | null
}

/**
 * The fields of a form, in the schema's order, then the noted values the schema does not list.
 * A field reads its label from its key: the schema describes it for the agent, not the person.
 */
export function formFieldsOf(form: ConversationFormOutputDto, i18n: I18n): FormFieldView[] {
  const schemaKeys =
    form.outputJsonSchema?.propertyOrdering ?? Object.keys(form.outputJsonSchema?.properties ?? {})
  const extraKeys = Object.keys(form.state).filter((key) => !schemaKeys.includes(key))
  return [...schemaKeys, ...extraKeys].map((key) => {
    const text = fieldTextOf(hasOwnKey(form.state, key) ? form.state[key] : undefined, i18n)
    return { key, label: fieldLabelOf(key), value: text === "" ? null : text }
  })
}

import type { ConversationFormOutputDto } from "@caseai-connect/desk-contracts"

/** A field of a form as the panel shows it: its label, and its value as text, if noted. */
export type FormFieldView = {
  key: string
  label: string
  value: string | null
}

/** A field key such as `birth_date` or `birthDate`, as a label: "Birth date". */
function labelOf(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A value the agent noted, as text in the person's language; `null` when there is none. */
function textOf(value: unknown, locale: string): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "string") return value
  if (typeof value === "number") return new Intl.NumberFormat(locale).format(value)
  if (typeof value === "boolean") return value ? "✓" : "✗"
  if (Array.isArray(value)) {
    const items = value.map((item) => textOf(item, locale)).filter((item) => item !== null)
    return items.length > 0 ? items.join(", ") : null
  }
  return JSON.stringify(value)
}

/**
 * The fields of a form, in the schema's order, then the noted values the schema does not list.
 * A field reads its label from its key: the schema describes it for the agent, not the person.
 */
export function formFieldsOf(form: ConversationFormOutputDto, locale: string): FormFieldView[] {
  const schemaKeys =
    form.outputJsonSchema?.propertyOrdering ?? Object.keys(form.outputJsonSchema?.properties ?? {})
  const extraKeys = Object.keys(form.state).filter((key) => !schemaKeys.includes(key))
  return [...schemaKeys, ...extraKeys].map((key) => ({
    key,
    label: labelOf(key),
    value: textOf(form.state[key], locale),
  }))
}

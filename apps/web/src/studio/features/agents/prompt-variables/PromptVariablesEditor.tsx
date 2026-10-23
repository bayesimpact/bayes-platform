import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldDescription, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * One declared `{{variable}}` and the value the caller is entering for it.
 */
export type PromptVariableField = {
  /** The variable name as written in the instructions, without the braces. */
  name: string
  value: string
  /** An operator-configured default (the public / embed channel). */
  defaultValue?: string | null
}

export type PromptVariablesEditorProps = {
  fields: PromptVariableField[]
  /** Called with the full values map whenever any field changes. */
  onChange: (values: Record<string, string>) => void
  disabled?: boolean
  /**
   * Flag a variable that has neither a value nor a default as required — the
   * playground channel, where a session is refused when one is missing.
   */
  requireValues?: boolean
  title?: string
  description?: string
}

/**
 * Collects a value for every `{{variable}}` an agent declares in its
 * instructions. Reused by the playground session-creation dialog and the agent
 * settings defaults editor; the two differ only in `requireValues` and in
 * whether the fields carry a `defaultValue`.
 */
export function PromptVariablesEditor({
  fields,
  onChange,
  disabled = false,
  requireValues = false,
  title,
  description,
}: PromptVariablesEditorProps) {
  const { t } = useTranslation()

  const update = (name: string, value: string) => {
    const values: Record<string, string> = {}
    for (const field of fields) values[field.name] = field.value
    values[name] = value
    onChange(values)
  }

  const hasHeader = title !== undefined || description !== undefined

  return (
    <section className="flex flex-col gap-4">
      {hasHeader && (
        <header className="flex flex-col gap-1">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </header>
      )}

      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">{t("promptVariables:empty")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => {
            const defaultValue = field.defaultValue ?? ""
            const hasDefault = defaultValue.trim().length > 0
            const isBlank = field.value.trim().length === 0
            const isRequired = requireValues && isBlank && !hasDefault
            return (
              <Field key={field.name}>
                <FieldLabel htmlFor={`prompt-variable-${field.name}`}>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {`{{ ${field.name} }}`}
                  </code>
                  {isRequired && (
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  )}
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id={`prompt-variable-${field.name}`}
                    value={field.value}
                    disabled={disabled}
                    placeholder={hasDefault ? defaultValue : t("promptVariables:valuePlaceholder")}
                    aria-invalid={isRequired || undefined}
                    className={isRequired ? "border-destructive" : undefined}
                    onChange={(event) => update(field.name, event.target.value)}
                  />
                  {field.value.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      onClick={() => update(field.name, hasDefault ? defaultValue : "")}
                      aria-label={t("promptVariables:clear", { name: field.name })}
                    >
                      <XIcon />
                    </Button>
                  )}
                </div>
                {isRequired ? (
                  <FieldDescription className="text-destructive">
                    {t("promptVariables:required")}
                  </FieldDescription>
                ) : hasDefault && isBlank ? (
                  <FieldDescription>
                    {t("promptVariables:default", { value: defaultValue })}
                  </FieldDescription>
                ) : null}
              </Field>
            )
          })}
        </div>
      )}
    </section>
  )
}

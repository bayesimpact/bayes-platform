import { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { CodeIcon, ListIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { OutputSchemaBuilder } from "./OutputSchemaBuilder"

/**
 * The output-json-schema editor shared by the Output tab (extraction agents) and
 * the Tools tab (fillForm form definition): a visual builder with an advanced raw
 * JSON mode. Remount it (change its `key`) to re-seed from the current value —
 * both modes hold their own internal editing state.
 *
 * When the raw JSON is invalid we keep the author in advanced mode so switching
 * to the builder — which can only render a valid schema — never silently
 * discards their in-progress edits. `version` is a remount key for the textarea:
 * bumping it re-seeds it from the form value. Kept in one object to stay within
 * the component's local-state budget.
 */
export function OutputSchemaField({
  value,
  onChange,
  allowOrdering,
}: {
  value: Record<string, unknown> | undefined
  onChange: (schema: unknown) => void
  allowOrdering: boolean
}) {
  const { t } = useTranslation()

  const [editor, setEditor] = useState<{
    advancedMode: boolean
    jsonError: string | null
    version: number
  }>({ advancedMode: false, jsonError: null, version: 0 })
  const { advancedMode, jsonError, version } = editor

  return (
    <>
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={advancedMode && jsonError !== null}
          onClick={() =>
            setEditor((previous) => ({ ...previous, advancedMode: !previous.advancedMode }))
          }
        >
          {advancedMode ? <ListIcon /> : <CodeIcon />}
          {advancedMode
            ? t("agent:props.schemaBuilder.visualMode")
            : t("agent:props.schemaBuilder.advancedMode")}
        </Button>
      </div>

      {advancedMode ? (
        <>
          <Textarea
            key={version}
            id="outputJsonSchema"
            rows={10}
            className="font-mono min-h-56"
            defaultValue={value ? JSON.stringify(value, null, 2) : ""}
            aria-invalid={jsonError ? "true" : "false"}
            onChange={(event) => {
              const raw = event.target.value
              if (raw.trim() === "") {
                onChange({})
                setEditor((previous) => ({ ...previous, jsonError: null }))
                return
              }
              try {
                const parsed = JSON.parse(raw)
                const validationResult = outputJsonSchemaSchema.safeParse(parsed)
                onChange(parsed)
                setEditor((previous) => ({
                  ...previous,
                  jsonError: validationResult.success
                    ? null
                    : (validationResult.error.issues.at(0)?.message ??
                      t("agent:props.validation.outputJsonSchemaInvalid")),
                }))
              } catch {
                onChange(raw)
                setEditor((previous) => ({
                  ...previous,
                  jsonError: t("agent:props.validation.outputJsonSchemaInvalid"),
                }))
              }
            }}
          />
          {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
        </>
      ) : (
        <OutputSchemaBuilder
          key={version}
          value={value}
          allowOrdering={allowOrdering}
          onChange={(schema) => onChange(schema)}
        />
      )}
    </>
  )
}

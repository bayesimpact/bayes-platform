import { Badge } from "@caseai-connect/ui/shad/badge"
import { Separator } from "@caseai-connect/ui/shad/separator"

/**
 * Renders the key/value list for a form agent's output: every property declared
 * in the output schema, filled with the session result when available. Shared by
 * the form session result panel and the sub-agent form result sheet.
 */
export function FormResultFields({
  outputJsonSchema,
  result,
}: {
  outputJsonSchema?: Record<string, unknown>
  result?: Record<string, unknown>
}) {
  const fields = buildFields({ outputJsonSchema, result })

  return (
    <div className="flex flex-col gap-1">
      {Object.entries(fields).map(([key, value], index) => {
        const hasValue = value !== ""
        return (
          <div key={key}>
            {index > 0 && <Separator className="opacity-50" />}
            <div className="flex gap-2 py-4 items-center">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {key}
              </span>
              {hasValue ? (
                <Badge variant="outline" className="w-fit text-muted-foreground font-mono">
                  {value}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="w-fit text-muted-foreground opacity-50 font-mono"
                >
                  —
                </Badge>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function buildFields({
  outputJsonSchema,
  result,
}: {
  outputJsonSchema?: Record<string, unknown>
  result?: Record<string, unknown>
}): Record<string, string> {
  const properties = (outputJsonSchema?.properties ?? {}) as Record<string, unknown>
  const fields = Object.fromEntries(Object.keys(properties).map((key) => [key, ""]))

  if (result) {
    for (const key of Object.keys(fields)) {
      if (key in result) {
        fields[key] = String(result[key])
      }
    }
  }

  return fields
}

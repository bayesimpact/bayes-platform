import { Trans } from "@lingui/react/macro"
import { cn } from "cn"

export type FilledFormProps = {
  /**
   * The fields the agent filled while it answered: none filled is `{}`, and an agent that
   * collects no form gives `null`.
   */
  formState: Record<string, unknown> | null
  /** Whether the text is cut after three lines, as in a table's cell. */
  isCut?: boolean
}

/** The form an agent filled while it answered a record of a run, as indented JSON. */
export function FilledForm({ formState, isCut = false }: FilledFormProps) {
  if (formState === null) return <span className="text-muted-foreground">–</span>
  if (Object.keys(formState).length === 0) {
    return (
      <span className="text-muted-foreground">
        <Trans comment="A record of a run whose agent filled no field of its form">
          No fields filled
        </Trans>
      </span>
    )
  }
  return (
    <pre
      className={cn(
        "min-w-40 font-mono text-xs whitespace-pre-wrap wrap-anywhere",
        isCut && "line-clamp-3",
      )}
    >
      {JSON.stringify(formState, null, 2)}
    </pre>
  )
}

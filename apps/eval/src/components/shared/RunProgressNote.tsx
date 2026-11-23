import { Trans, useLingui } from "@lingui/react/macro"
import { LoaderCircleIcon } from "lucide-react"

export type RunProgressNoteProps = {
  /** The figures of the run, or `null` before it started. */
  summary: { total: number; running: number } | null
}

/**
 * What the table of a run's results says while the run goes on and has no result to show yet:
 * how many of its records are done.
 */
export function RunProgressNote({ summary }: RunProgressNoteProps) {
  const { i18n } = useLingui()
  const processed = i18n.number(summary ? summary.total - summary.running : 0)
  const total = i18n.number(summary?.total ?? 0)
  return (
    <span className="inline-flex flex-col items-center gap-2">
      <LoaderCircleIcon aria-hidden className="size-5 animate-spin" />
      <Trans>
        {processed} of {total} records processed. This may take a few minutes.
      </Trans>
    </span>
  )
}

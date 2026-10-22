import type { CsvExtractionRunDetailOutputDto } from "@caseai-connect/desk-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { Progress } from "@/components/ui/progress"
import { isCsvRunLive } from "../api/queries"

export type CsvRunProgressProps = {
  run: CsvExtractionRunDetailOutputDto
}

/** How far a CSV run went: a bar of the rows done, and the ones that failed or still run. */
export function CsvRunProgress({ run }: CsvRunProgressProps) {
  const { t, i18n } = useLingui()
  const summary = run.summary
  const isLive = isCsvRunLive(run.status)
  if (!summary) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border bg-background p-4 dark:bg-card">
        <p className="animate-pulse text-sm font-medium motion-reduce:animate-none">
          <Trans>The run is about to start…</Trans>
        </p>
      </section>
    )
  }
  const { total, processed, errors, running } = summary
  const ratio = total === 0 ? 1 : processed / total
  const percent = new Intl.NumberFormat(i18n.locale, { style: "percent" }).format(ratio)
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-background p-4 dark:bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p className="font-medium tabular-nums">
          <Trans>
            {processed} of <Plural value={total} one="# row" other="# rows" />
          </Trans>
        </p>
        <p className="flex items-center gap-3 text-muted-foreground tabular-nums">
          {errors > 0 ? (
            <span className="text-destructive">
              <Plural value={errors} one="# failed" other="# failed" />
            </span>
          ) : null}
          {isLive && running > 0 ? (
            <span>
              <Plural value={running} one="# running" other="# running" />
            </span>
          ) : null}
          <span>{percent}</span>
        </p>
      </div>
      <Progress value={ratio * 100} aria-label={t`Rows done`} />
    </section>
  )
}

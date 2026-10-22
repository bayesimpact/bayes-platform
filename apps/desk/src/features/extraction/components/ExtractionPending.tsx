import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"
import { durationOf } from "@/lib/format-time"

export type ExtractionPendingProps = {
  createdAt: number
  /** The time the page shows, which moves every second while the agent reads. */
  now: number
}

/**
 * What a page shows while the agent reads the document: how long it has been reading, the shape
 * of the fields to come, and that the person may leave.
 */
export function ExtractionPending({ createdAt, now }: ExtractionPendingProps) {
  const { t, i18n } = useLingui()
  const elapsed = durationOf(now - createdAt, i18n.locale)
  return (
    <section
      aria-busy="true"
      aria-label={t`The agent is reading the document`}
      className="flex flex-col gap-4 rounded-2xl border bg-background p-4 dark:bg-card"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="animate-pulse text-sm font-medium motion-reduce:animate-none">
          <Trans>The agent is reading the document…</Trans>
        </p>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{elapsed}</span>
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        {["w-2/3", "w-1/2", "w-5/6", "w-1/3"].map((width) => (
          <div key={width} className="grid grid-cols-3 gap-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className={cn("col-span-2 h-4", width)} />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <Trans>
          You can leave this page: the extraction goes on, and its mark in the sidebar turns once it
          ends.
        </Trans>
      </p>
    </section>
  )
}

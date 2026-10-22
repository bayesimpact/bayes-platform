import { Trans, useLingui } from "@lingui/react/macro"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/hooks/use-now"
import { durationOf } from "@/lib/format-time"

export type ExtractionPendingProps = {
  createdAt: number
}

/**
 * What a page shows while the agent reads the document: how long it has been reading, the shape
 * of the fields to come, and that the person may leave.
 */
export function ExtractionPending({ createdAt }: ExtractionPendingProps) {
  const { t, i18n } = useLingui()
  const now = useNow(1000, true)
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
          <div key={width} className="grid grid-cols-[minmax(8rem,1fr)_2fr] gap-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className={`h-4 ${width}`} />
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

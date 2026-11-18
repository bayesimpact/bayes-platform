import type { ReactNode } from "react"

export type StatCardProps = {
  label: ReactNode
  /** The figure, already formatted. */
  value: ReactNode
  /** A line under the figure that says what it counts. */
  hint?: ReactNode
}

/** One figure of a summary, with what it measures. */
export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-background p-4 dark:bg-card">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

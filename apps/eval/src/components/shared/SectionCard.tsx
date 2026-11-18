import type { ReactNode } from "react"

export type SectionCardProps = {
  title: ReactNode
  description?: ReactNode
  /** What sits at the end of the title's row, such as a count or a button. */
  aside?: ReactNode
  children: ReactNode
}

/** A titled block of a page: what it holds, a line on it, and its content in a frame. */
export function SectionCard({ title, description, aside, children }: SectionCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-background p-4 md:p-6 dark:bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {aside ? <div className="text-sm text-muted-foreground">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}

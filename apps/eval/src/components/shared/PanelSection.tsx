import type { ReactNode } from "react"

export type PanelSectionProps = {
  title: ReactNode
  description?: ReactNode
  /** What sits at the end of the title's row, such as a count. */
  aside?: ReactNode
  children: ReactNode
}

/** A titled block of a side panel: a line sets it apart from the block above it. */
export function PanelSection({ title, description, aside, children }: PanelSectionProps) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-base font-semibold">{title}</h3>
          {description ? <p className="text-muted-foreground">{description}</p> : null}
        </div>
        {aside ? <div className="text-muted-foreground">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}

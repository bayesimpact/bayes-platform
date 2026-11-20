import type { ReactNode } from "react"

export type RunFactProps = {
  label: ReactNode
  children: ReactNode
}

/** A fact of a run's side panel, in its list: its name, then its value. */
export function RunFact({ label, children }: RunFactProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-medium">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

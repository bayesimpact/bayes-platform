import type { ReactNode } from "react"

/** Title and description of a bordered section of an agent editor tab, with an optional action. */
export function AgentTabSectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {action}
    </div>
  )
}

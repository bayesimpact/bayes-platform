import { HeaderActions } from "@caseai-connect/app-ui/compositions/HeaderActions"
import type { ReactNode } from "react"
import { HeaderBack } from "./HeaderBack"

export type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** A link back to the page above, shown at the start of the shell's top bar. */
  back?: ReactNode
  /** What sits above the title, in small: an id, a kind. */
  eyebrow?: ReactNode
  /** What sits beside the title, such as a status. */
  badge?: ReactNode
  /** The page's actions, shown at the end of the shell's top bar. */
  actions?: ReactNode
}

/**
 * The top of a page: its title and what it is for. The way back and the actions go to the shell's
 * top bar, which stays in view as the page scrolls.
 */
export function PageHeader({ title, description, back, eyebrow, badge, actions }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-1">
      {back ? <HeaderBack>{back}</HeaderBack> : null}
      {actions ? <HeaderActions>{actions}</HeaderActions> : null}
      {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {badge}
      </div>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
    </header>
  )
}

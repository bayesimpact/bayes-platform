import { useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

export type AppHeaderProps = {
  /** The install's logo, from its theme files. */
  logoUrl: string
  /** What sits at the end of the bar, such as the user menu. */
  actions: ReactNode
}

export function AppHeader({ logoUrl, actions }: AppHeaderProps) {
  const { t } = useLingui()
  return (
    <header className="sticky top-0 z-10 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center">
          <img src={logoUrl} alt={t`Home of the Desk`} className="h-7 w-auto" />
        </Link>
        {actions}
      </div>
    </header>
  )
}

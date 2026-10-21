import { useLingui } from "@lingui/react/macro"
import { XIcon } from "lucide-react"
import { type ReactNode, useId } from "react"
import { Button } from "@/components/ui/button"

export type SidePanelProps = {
  title: ReactNode
  description?: ReactNode
  onClose: () => void
  /** What the panel ends with, such as an action on everything it lists. */
  footer?: ReactNode
  children: ReactNode
}

/**
 * A panel docked on the right of the page, beside it rather than over it, as an artifact opens in
 * the Claude app: the page stays in view and usable. Below a laptop's width, which leaves too
 * little room for both, it covers the page.
 */
export function SidePanel({ title, description, onClose, footer, children }: SidePanelProps) {
  const { t } = useLingui()
  const titleId = useId()
  return (
    <aside
      aria-labelledby={titleId}
      className="fixed inset-0 z-30 flex flex-col bg-background duration-200 animate-in fade-in-0 slide-in-from-right-4 lg:static lg:inset-auto lg:z-auto lg:w-96 lg:shrink-0 lg:border-l"
    >
      <header className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="font-medium">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={t`Close the panel`} onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 text-sm">{children}</div>
      {footer ? <footer className="border-t px-4 py-3">{footer}</footer> : null}
    </aside>
  )
}

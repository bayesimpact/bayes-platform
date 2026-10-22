import { useLingui } from "@lingui/react/macro"
import { XIcon } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useInertPageBehind } from "@/hooks/use-inert-page-behind"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useResizableWidth } from "@/hooks/use-resizable-width"
import { ResizeHandle } from "./ResizeHandle"

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
 * the Claude app: a card with rounded corners and a soft shadow, a little apart from the window's
 * edge, while the page stays in view and usable. Below a laptop's width, which leaves too
 * little room for both, it covers the page, which turns inert behind it as behind a dialog.
 *
 * Opening it moves the focus to its title, so the keyboard and screen readers land in it; Escape
 * closes it from anywhere inside, and the focus goes back to what opened it.
 */
export function SidePanel({ title, description, onClose, footer, children }: SidePanelProps) {
  const { t } = useLingui()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  // Tailwind's `lg`, from which the panel docks beside the page.
  const isDocked = useMediaQuery("(min-width: 64rem)")
  useInertPageBehind(panelRef, !isDocked, '[data-slot="sidebar-wrapper"]')
  const panelWidth = useResizableWidth({
    storageKey: "desk.sidePanelWidth",
    defaultWidth: 384,
    minWidth: 320,
    maxWidth: 720,
    edge: "left",
  })
  // What had the focus before the panel opened, kept across a re-run of the effect.
  const openerRef = useRef<Element | null>(null)
  // The focus is outside React, which an effect moves when the panel opens and closes.
  useEffect(() => {
    openerRef.current ??= document.activeElement
    const opener = openerRef.current
    titleRef.current?.focus()
    return () => {
      // A panel closed with the focus in it leaves the focus nowhere: it goes back to the opener.
      const isFocusLost =
        document.activeElement === null || document.activeElement === document.body
      if (isFocusLost && opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // A dialog or menu opened from the panel sits in a portal: its Escape closes it alone.
    if (event.key !== "Escape" || event.defaultPrevented) return
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return
    event.preventDefault()
    onClose()
  }

  return (
    <aside
      ref={panelRef}
      onKeyDown={handleKeyDown}
      aria-labelledby={titleId}
      style={{ "--side-panel-width": `${panelWidth.width}px` }}
      className="fixed inset-0 z-30 flex flex-col bg-background duration-200 animate-in fade-in-0 slide-in-from-right-4 lg:relative lg:inset-auto lg:z-20 lg:my-2 lg:mr-2 lg:w-(--side-panel-width) lg:shrink-0 lg:rounded-xl lg:border lg:border-foreground/15 lg:shadow-sm"
    >
      <ResizeHandle
        edge="left"
        aria-label={t`Resize the panel`}
        className="hidden lg:flex"
        {...panelWidth.handleProps}
      />
      <header className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="font-medium outline-none">
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

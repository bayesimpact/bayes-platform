import { PanelRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export type SidePanelToggleProps = {
  isOpen: boolean
  onToggle: () => void
  /** What the panel holds, which names the button. */
  children: ReactNode
  /** Whether the panel holds the page's main task, which the closed button then calls for. */
  isPrimary?: boolean
}

/** The button of the bar above the page that opens and closes the page's side panel. */
export function SidePanelToggle({
  isOpen,
  onToggle,
  children,
  isPrimary = false,
}: SidePanelToggleProps) {
  return (
    <Button
      variant={isOpen ? "secondary" : isPrimary ? "default" : "outline"}
      size="sm"
      aria-pressed={isOpen}
      onClick={onToggle}
    >
      <PanelRightIcon data-icon="inline-start" aria-hidden />
      {children}
    </Button>
  )
}

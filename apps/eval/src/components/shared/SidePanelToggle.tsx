import { PanelRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export type SidePanelToggleProps = {
  isOpen: boolean
  onToggle: () => void
  /** What the panel holds, which names the button. */
  children: ReactNode
}

/** The button of the bar above the page that opens and closes the page's side panel. */
export function SidePanelToggle({ isOpen, onToggle, children }: SidePanelToggleProps) {
  return (
    <Button
      variant={isOpen ? "secondary" : "outline"}
      size="sm"
      aria-pressed={isOpen}
      onClick={onToggle}
    >
      <PanelRightIcon data-icon="inline-start" aria-hidden />
      {children}
    </Button>
  )
}

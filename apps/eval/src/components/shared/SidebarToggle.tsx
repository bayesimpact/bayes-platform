import { isApplePlatform } from "@caseai-connect/frontend-lib"
import { useLingui } from "@lingui/react/macro"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SidebarPeekHandlers } from "@/hooks/use-sidebar-peek"

/**
 * The button that shows or hides the sidebar, with a tooltip that names its shortcut: ⌘B on an
 * Apple system, Ctrl+B elsewhere. The tooltip says what a click will do. While the sidebar is
 * hidden, a pointer on the button shows it for a moment.
 */
export type SidebarToggleProps = {
  /** What a pointer on the button does while the sidebar is hidden: it shows it, for a moment. */
  peekHandlers: SidebarPeekHandlers
  /** Called when the button is clicked, which shows or hides the sidebar for good. */
  onToggle: () => void
}

export function SidebarToggle({ peekHandlers, onToggle }: SidebarToggleProps) {
  const { t } = useLingui()
  const { open, openMobile, isMobile } = useSidebar()
  const isOpen = isMobile ? openMobile : open
  const action = isOpen ? t`Hide the sidebar` : t`Show the sidebar`
  const modifier = isApplePlatform()
    ? "⌘"
    : t({ message: "Ctrl", comment: "The Control key of a keyboard" })
  return (
    <Tooltip>
      <TooltipTrigger
        render={<SidebarTrigger aria-label={action} onClick={onToggle} {...peekHandlers} />}
      />
      <TooltipContent side="bottom" align="start" className="flex items-center gap-2">
        {action}
        <KbdGroup>
          <Kbd>{modifier}</Kbd>
          <Kbd>B</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  )
}

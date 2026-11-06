import { useLingui } from "@lingui/react/macro"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { isApplePlatform } from "@/lib/platform"

/**
 * The button that shows or hides the sidebar, with a tooltip that names its shortcut: ⌘B on an
 * Apple system, Ctrl+B elsewhere. The tooltip says what a click will do.
 */
export function SidebarToggle() {
  const { t } = useLingui()
  const { open, openMobile, isMobile } = useSidebar()
  const isOpen = isMobile ? openMobile : open
  const action = isOpen ? t`Hide the sidebar` : t`Show the sidebar`
  const modifier = isApplePlatform()
    ? "⌘"
    : t({ message: "Ctrl", comment: "The Control key of a keyboard" })
  return (
    <Tooltip>
      <TooltipTrigger render={<SidebarTrigger aria-label={action} />} />
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

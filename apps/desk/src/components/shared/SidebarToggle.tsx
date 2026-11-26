import { SidebarTrigger, useSidebar } from "@caseai-connect/app-ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/app-ui/components/tooltip"
import { useLingui } from "@lingui/react/macro"
import type { ComponentProps } from "react"
import { ShortcutHint } from "./ShortcutHint"

/** The handlers that let the hidden sidebar peek. */
type SidebarToggleProps = Pick<
  ComponentProps<typeof SidebarTrigger>,
  "onPointerEnter" | "onPointerLeave" | "onClick"
>

/**
 * The button that shows or hides the sidebar, with a tooltip that names its shortcut: ⌘B on an
 * Apple system, Ctrl+B elsewhere. The tooltip says what a click will do.
 */
export function SidebarToggle(props: SidebarToggleProps) {
  const { t } = useLingui()
  const { open, openMobile, isMobile } = useSidebar()
  const isOpen = isMobile ? openMobile : open
  const action = isOpen ? t`Hide the sidebar` : t`Show the sidebar`
  return (
    <Tooltip>
      <TooltipTrigger render={<SidebarTrigger aria-label={action} {...props} />} />
      <TooltipContent side="bottom" align="start" className="flex items-center gap-2">
        {action}
        <ShortcutHint letter="B" />
      </TooltipContent>
    </Tooltip>
  )
}

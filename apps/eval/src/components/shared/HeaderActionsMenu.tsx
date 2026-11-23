import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { useLingui } from "@lingui/react/macro"
import { EllipsisVerticalIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useHasChildren } from "@/hooks/use-has-children"

export type HeaderActionsMenuProps = {
  /** Receives the element where the pages put their actions. */
  slotRef: (element: HTMLElement | null) => void
}

/**
 * At phone width, the page's actions in a menu at the end of the top bar, which shows once a page
 * has some. The menu stays in the page while closed: an action's confirmation, which opens from
 * it, lives on after the menu closes.
 */
export function HeaderActionsMenu({ slotRef }: HeaderActionsMenuProps) {
  const { t } = useLingui()
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const hasActions = useHasChildren(slot)
  const handleSlot = (element: HTMLElement | null) => {
    setSlot(element)
    slotRef(element)
  }
  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t`Actions of the page`}
            className={hasActions ? undefined : "hidden"}
          />
        }
      >
        <EllipsisVerticalIcon aria-hidden />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal keepMounted>
        <PopoverPrimitive.Positioner align="end" sideOffset={4} className="isolate z-50">
          <PopoverPrimitive.Popup
            ref={handleSlot}
            // An action chosen closes the menu.
            onClick={() => setIsOpen(false)}
            className="z-50 flex min-w-48 flex-col items-stretch gap-1 rounded-lg bg-popover p-1.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden *:justify-start *:border-transparent! *:bg-transparent! *:shadow-none! *:hover:bg-muted! data-closed:hidden"
          />
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

import { MessageCircleIcon, XIcon } from "lucide-react"
import { cn } from "../chat/lib/cn"

export type TriggerButtonPosition = "bottom-right" | "bottom-left"

export type TriggerButtonProps = {
  isOpen: boolean
  onClick: () => void
  /** Primary colour applied to the button background */
  primaryColor?: string
  /** Corner the button is anchored to */
  position?: TriggerButtonPosition
  /** Additional class names */
  className?: string
}

export function TriggerButton({
  isOpen,
  onClick,
  primaryColor = "#2563eb",
  position = "bottom-right",
  className,
}: TriggerButtonProps) {
  return (
    <button
      type="button"
      aria-label={isOpen ? "Close chat" : "Open chat"}
      onClick={onClick}
      style={{ backgroundColor: primaryColor }}
      className={cn(
        "flex size-14 items-center justify-center rounded-full text-white shadow-lg",
        "transition-all duration-200 hover:brightness-90 hover:scale-105 active:scale-95",
        position === "bottom-right" ? "self-end" : "self-start",
        className,
      )}
    >
      {isOpen ? (
        <XIcon className="size-6 transition-transform duration-200" />
      ) : (
        <MessageCircleIcon className="size-6 transition-transform duration-200" />
      )}
    </button>
  )
}

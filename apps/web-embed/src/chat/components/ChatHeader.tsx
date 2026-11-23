import { ChevronDownIcon, SquarePenIcon, XIcon } from "lucide-react"
import type * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../lib/cn"
import { DotGridMark } from "./DotGrid"

export function ChatHeader({
  agentName,
  logoUrl,
  onClose,
  collapsible = false,
  onNewConversation,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  agentName?: string
  logoUrl?: string
  onClose?: () => void
  /** The window floats over the page and closing it only folds it back into the launcher, so
   *  the button says so with a chevron, as a messenger does. */
  collapsible?: boolean
  onNewConversation?: () => void
}) {
  const { t } = useTranslation("chat")
  const displayName = agentName ?? t("header.defaultAgentName")
  // On a phone the launcher opens the chat full screen, and a cross reads better than a chevron
  // for leaving it, as messengers show it there.
  const isFullScreenPhone =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse) and (max-width: 640px)").matches

  return (
    <div
      data-slot="chat-header"
      className={cn(
        "chat-header flex h-16 shrink-0 items-center gap-3 px-5 text-[var(--embed-on-primary)]",
        className,
      )}
      style={{ backgroundColor: "var(--embed-primary)" }}
      {...props}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={displayName} className="h-9 max-w-[120px] object-contain" />
      ) : (
        <div className="flex size-9 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--embed-on-primary)_30%,transparent)]">
          <DotGridMark />
        </div>
      )}
      <span className="flex-1 font-medium">{displayName}</span>
      {onNewConversation && (
        <button
          type="button"
          aria-label={t("header.newConversationAriaLabel")}
          title={t("header.newConversationAriaLabel")}
          onClick={onNewConversation}
          className="flex size-8 items-center justify-center rounded-full opacity-60 transition hover:bg-[color-mix(in_srgb,var(--embed-on-primary)_15%,transparent)] hover:opacity-100"
        >
          <SquarePenIcon className="size-4" />
        </button>
      )}
      {onClose &&
        (collapsible && !isFullScreenPhone ? (
          <button
            type="button"
            aria-label={t("header.collapseAriaLabel")}
            title={t("header.collapseAriaLabel")}
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--embed-on-primary)_14%,transparent)] transition hover:bg-[color-mix(in_srgb,var(--embed-on-primary)_26%,transparent)]"
          >
            <ChevronDownIcon className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t("header.closeAriaLabel")}
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full opacity-60 transition hover:bg-[color-mix(in_srgb,var(--embed-on-primary)_15%,transparent)] hover:opacity-100"
          >
            <XIcon className="size-4" />
          </button>
        ))}
    </div>
  )
}

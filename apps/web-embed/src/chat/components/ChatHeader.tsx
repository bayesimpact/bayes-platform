import { SparklesIcon, SquarePenIcon, XIcon } from "lucide-react"
import type * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../lib/cn"

export function ChatHeader({
  agentName,
  logoUrl,
  onClose,
  onNewConversation,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  agentName?: string
  logoUrl?: string
  onClose?: () => void
  onNewConversation?: () => void
}) {
  const { t } = useTranslation("chat")
  const displayName = agentName ?? t("header.defaultAgentName")

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
          <SparklesIcon className="size-5" />
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
      {onClose && (
        <button
          type="button"
          aria-label={t("header.closeAriaLabel")}
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full opacity-60 transition hover:bg-[color-mix(in_srgb,var(--embed-on-primary)_15%,transparent)] hover:opacity-100"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

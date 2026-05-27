import { SparklesIcon, XIcon } from "lucide-react"
import type * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../lib/cn"

export function ChatHeader({
  agentName,
  logoUrl,
  onClose,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  agentName?: string
  logoUrl?: string
  onClose?: () => void
}) {
  const { t } = useTranslation("chat")
  const displayName = agentName ?? t("header.defaultAgentName")

  return (
    <div
      data-slot="chat-header"
      className={cn("flex h-16 shrink-0 items-center gap-3 px-5 text-white", className)}
      style={{ backgroundColor: "var(--embed-primary)" }}
      {...props}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={displayName} className="size-9 rounded-full object-cover" />
      ) : (
        <div className="flex size-9 items-center justify-center rounded-full border border-white/30">
          <SparklesIcon className="size-5" />
        </div>
      )}
      <span className="flex-1 font-medium">{displayName}</span>
      {onClose && (
        <button
          type="button"
          aria-label={t("header.closeAriaLabel")}
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/20 hover:text-white"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

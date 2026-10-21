import { Trans } from "@lingui/react/macro"
import { LoaderCircleIcon } from "lucide-react"

/** What an app's card shows while its HTML or the app itself loads. */
export function McpAppPlaceholder() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="absolute inset-0 flex min-h-18 items-center gap-2 rounded-xl border bg-background px-4 text-sm text-muted-foreground"
    >
      <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
      <span className="animate-pulse">
        <Trans>Loading the interactive card…</Trans>
      </span>
    </div>
  )
}

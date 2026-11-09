import { Trans } from "@lingui/react/macro"
import { RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useIsNewReleaseOut } from "@/hooks/use-is-new-release-out"

/**
 * A strip above the page once a new release of the Desk is deployed. The person reloads when they
 * choose, warned that the reload clears what they have not sent or saved.
 */
export function NewReleaseBanner() {
  const isNewReleaseOut = useIsNewReleaseOut()
  if (!isNewReleaseOut) return null
  return (
    // An `output` has the status role: a screen reader reads the banner once it shows.
    <output className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary px-4 py-2 text-sm text-primary-foreground">
      <RefreshCwIcon aria-hidden className="size-4 shrink-0" />
      <span>
        <Trans>
          A new version of the Desk is available. Reloading the page clears what you have not sent
          or saved.
        </Trans>
      </span>
      <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
        <Trans>Reload</Trans>
      </Button>
    </output>
  )
}

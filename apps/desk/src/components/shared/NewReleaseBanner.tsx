import { Trans } from "@lingui/react/macro"
import { RotateCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useIsNewReleaseOut } from "@/hooks/use-is-new-release-out"

/**
 * A note at the top of the page once a new release of the Desk is deployed, in the column and the
 * card of the message box, so it reads as part of the page rather than an alert. The person
 * reloads when they choose, warned that the reload clears what they have not sent or saved.
 */
export function NewReleaseBanner() {
  const isNewReleaseOut = useIsNewReleaseOut()
  if (!isNewReleaseOut) return null
  return (
    // Above the fade of the bar, which would blur its top edge.
    <div className="relative z-20 shrink-0 px-4 pb-2">
      {/* An `output` has the status role: a screen reader reads the note once it shows. */}
      <output className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border bg-background p-3 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300 dark:bg-card">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <RotateCwIcon aria-hidden className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium">
              <Trans>A new version of the Desk is available</Trans>
            </span>
            <span className="text-sm text-muted-foreground">
              <Trans>Reloading the page clears what you have not sent or saved.</Trans>
            </span>
          </span>
          <Button className="self-start sm:self-auto" onClick={() => window.location.reload()}>
            <Trans>Reload</Trans>
          </Button>
        </span>
      </output>
    </div>
  )
}

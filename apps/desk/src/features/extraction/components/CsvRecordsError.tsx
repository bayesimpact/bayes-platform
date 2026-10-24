import { Trans } from "@lingui/react/macro"
import { TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export type CsvRecordsErrorProps = {
  onRetry: () => void
}

/** The table of a CSV run's rows, when its page could not load: the rest of the page stays. */
export function CsvRecordsError({ onRetry }: CsvRecordsErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border p-8 text-center text-sm"
    >
      <TriangleAlertIcon aria-hidden className="size-5 text-muted-foreground" />
      <p>
        <Trans>The rows could not load. Check your connection, then try again.</Trans>
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Trans>Try again</Trans>
      </Button>
    </div>
  )
}

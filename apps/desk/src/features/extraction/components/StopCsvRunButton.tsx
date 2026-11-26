import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@caseai-connect/app-ui/components/alert-dialog"
import { Button } from "@caseai-connect/app-ui/components/button"
import { Trans } from "@lingui/react/macro"
import { CircleStopIcon } from "lucide-react"

export type StopCsvRunButtonProps = {
  /** The request that stops the run is on its way. */
  isStopping: boolean
  /** The last request to stop the run failed. */
  hasFailed: boolean
  onConfirm: () => void
}

/**
 * Stops a CSV run, after a confirmation: the rows left are not extracted. Its page shows it only
 * while the run goes on, so the confirmation leaves with it once the run ends, stopped or not.
 */
export function StopCsvRunButton({ isStopping, hasFailed, onConfirm }: StopCsvRunButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        <CircleStopIcon aria-hidden />
        <span className="max-sm:sr-only">
          <Trans comment="Stops a run in progress">Stop</Trans>
        </span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Stop this extraction?</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              The rows already done stay in the results file. The other rows will not be extracted.
            </Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hasFailed ? (
          <p role="alert" className="text-sm text-destructive">
            <Trans>The run could not be stopped. Try again.</Trans>
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <Button variant="destructive" disabled={isStopping} onClick={onConfirm}>
            <Trans>Stop</Trans>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

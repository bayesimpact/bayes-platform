import type { CsvExtractionRunDetailOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { CircleStopIcon, DownloadIcon, EllipsisIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { HeaderActions } from "@/components/shared/HeaderActions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { openBlankTab } from "@/lib/safe-url"
import {
  useCancelCsvExtraction,
  useOpenExtractionFile,
  useRetryCsvExtraction,
} from "../api/mutations"
import { isCsvRunLive } from "../api/queries"
import type { ExtractionAgentRef } from "../extraction-agent"

export type CsvRunActionsProps = {
  agent: ExtractionAgentRef
  run: CsvExtractionRunDetailOutputDto
  onDelete: () => void
}

/**
 * The actions of a CSV run, in the bar above the page: stopping it while it runs, trying again
 * once it failed, downloading its results file once there is one, and deleting it.
 */
export function CsvRunActions({ agent, run, onDelete }: CsvRunActionsProps) {
  const { t } = useLingui()
  const cancel = useCancelCsvExtraction(agent)
  const retry = useRetryCsvExtraction(agent)
  const openFile = useOpenExtractionFile(agent)
  const isLive = isCsvRunLive(run.status)

  const handleDownload = () =>
    openFile.mutate(
      { file: { kind: "csvResults", csvRunId: run.id }, tab: openBlankTab() },
      { onError: () => toast.error(t`The results file could not be opened.`) },
    )

  return (
    <HeaderActions>
      {isLive ? (
        <Button
          variant="outline"
          size="sm"
          disabled={cancel.isPending}
          onClick={() =>
            cancel.mutate(run.id, {
              onSuccess: () => toast.success(t`The run stopped. The rows done stay.`),
              onError: () => toast.error(t`The run could not be stopped. Try again.`),
            })
          }
        >
          <CircleStopIcon aria-hidden />
          <Trans comment="Stops a run in progress">Stop</Trans>
        </Button>
      ) : null}
      {run.status === "failed" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={retry.isPending}
          onClick={() =>
            retry.mutate(run.id, {
              onError: () => toast.error(t`The run could not start again. Try again.`),
            })
          }
        >
          <RotateCcwIcon aria-hidden />
          <Trans>Try again</Trans>
        </Button>
      ) : null}
      {run.csvExportDocumentId && !isLive ? (
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <DownloadIcon aria-hidden />
          <Trans>Download the results</Trans>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={t`More actions`} />}
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon aria-hidden />
            <Trans>Delete the extraction</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </HeaderActions>
  )
}

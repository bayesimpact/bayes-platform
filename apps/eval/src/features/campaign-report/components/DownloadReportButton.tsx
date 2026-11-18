import type { CampaignReportSessionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { reportCsvOf } from "../report-csv"

export type DownloadReportButtonProps = {
  sessions: CampaignReportSessionOutputDto[]
  /** The name of the file, without its extension. */
  fileName: string
}

/** Saves the report's sessions as a CSV file, built from what the page already shows. */
export function DownloadReportButton({ sessions, fileName }: DownloadReportButtonProps) {
  const handleDownload = () => {
    const url = URL.createObjectURL(
      new Blob([reportCsvOf(sessions)], { type: "text/csv;charset=utf-8" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = `${fileName}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Button variant="outline" onClick={handleDownload}>
      <DownloadIcon data-icon="inline-start" aria-hidden />
      <Trans>Download CSV</Trans>
    </Button>
  )
}

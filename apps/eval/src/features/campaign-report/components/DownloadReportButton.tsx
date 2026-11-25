import type { ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { campaignReportQueryOptions } from "../api/queries"
import { reportCsvOf } from "../report-csv"

export type DownloadReportButtonProps = {
  campaign: ReviewCampaignParamsDto
}

/**
 * Saves the report's sessions as a CSV file, with each session's answers to every question, built
 * from what the page already shows.
 */
export function DownloadReportButton({ campaign }: DownloadReportButtonProps) {
  const { data: report } = useSuspenseQuery(campaignReportQueryOptions(campaign))
  const fileName = `campaign-report-${campaign.reviewCampaignId}`
  const handleDownload = () => {
    const url = URL.createObjectURL(
      new Blob([reportCsvOf(report)], { type: "text/csv;charset=utf-8" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = `${fileName}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <DownloadIcon data-icon="inline-start" aria-hidden />
      <Trans>Download CSV</Trans>
    </Button>
  )
}

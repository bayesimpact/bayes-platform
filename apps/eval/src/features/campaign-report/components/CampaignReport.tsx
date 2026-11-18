import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { CampaignReportContent } from "./CampaignReportContent"
import { DownloadReportButton } from "./DownloadReportButton"

export type CampaignReportProps = {
  campaign: ReviewCampaignParamsDto
  /** The link back to the page the report was opened from. */
  back: ReactNode
}

/** The report of a campaign as a page of its own, for its reviewers. */
export function CampaignReport({ campaign, back }: CampaignReportProps) {
  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={<Trans>Campaign report</Trans>}
        actions={<DownloadReportButton campaign={campaign} />}
      />
      <CampaignReportContent campaign={campaign} />
    </PageContainer>
  )
}

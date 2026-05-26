"use client"

import { Button } from "@caseai-connect/ui/shad/button"
import { DownloadIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { getServices } from "@/di/services"
import { selectCurrentCampaignReport } from "../reports.selectors"
import { reviewCampaignsReportsActions } from "../reports.slice"
import { CampaignReport } from "./CampaignReport"

type Props = {
  backPath: string
}

export function CampaignReportPage({ backPath }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const report = useAppSelector(selectCurrentCampaignReport)

  useMount({ actions: reviewCampaignsReportsActions })

  const handleBack = () => {
    navigate(backPath)
  }
  return (
    <>
      <GridHeader
        onBack={handleBack}
        title={t("reviewCampaigns:report.title")}
        action={ADS.isFulfilled(report) && <DownloadCsvButton />}
      />

      <div className="flex flex-col gap-6 p-6 bg-white">
        <AsyncRoute data={[report]}>
          <WithData />
        </AsyncRoute>
      </div>
    </>
  )
}

function WithData() {
  const report = useValue(selectCurrentCampaignReport)
  return <CampaignReport report={report} />
}

function DownloadCsvButton() {
  const { t } = useTranslation()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadCsv = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const blob = await getServices().reviewCampaignsReports.getReportCsv({
        organizationId,
        projectId,
        reviewCampaignId,
      })
      const url = URL.createObjectURL(blob)
      const linkElement = document.createElement("a")
      linkElement.href = url
      linkElement.download = `campaign-report-${reviewCampaignId}.csv`
      linkElement.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownloadCsv} disabled={isDownloading}>
      <DownloadIcon />{" "}
      {isDownloading
        ? t("reviewCampaigns:report.downloading")
        : t("reviewCampaigns:report.downloadCsv")}
    </Button>
  )
}

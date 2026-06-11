import type { CampaignReportSessionRowDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { InboxIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { buildDate } from "@/common/utils/build-date"

type Props = {
  rows: CampaignReportSessionRowDto[]
}

const shortenId = (id: string) => `${id.slice(0, 8)}…`

const formatRating = (rating: number | null): string => (rating === null ? "—" : rating.toFixed(2))

export function ReportSessionMatrix({ rows }: Props) {
  const { t } = useTranslation()

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>{t("reviewCampaigns:report.sessionMatrix.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {t("reviewCampaigns:report.sessionMatrix.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("reviewCampaigns:report.sessionMatrix.session")}</TableHead>
          <TableHead>{t("reviewCampaigns:report.sessionMatrix.started")}</TableHead>
          <TableHead className="text-right">
            {t("reviewCampaigns:report.sessionMatrix.tester")}
          </TableHead>
          <TableHead className="text-right">
            {t("reviewCampaigns:report.sessionMatrix.reviewers")}
          </TableHead>
          <TableHead className="text-right">
            {t("reviewCampaigns:report.sessionMatrix.meanReviewer")}
          </TableHead>
          <TableHead className="text-right">
            {t("reviewCampaigns:report.sessionMatrix.spread")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.sessionId}>
            <TableCell className="flex flex-col gap-1">
              <span className="font-mono text-xs">{shortenId(row.sessionId)}</span>
              <Badge variant="outline" className="w-fit text-xs">
                {row.agentType}
              </Badge>
            </TableCell>
            <TableCell>{buildDate(row.startedAt)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatRating(row.testerRating)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.reviewerCount === 0
                ? "—"
                : `${row.reviewerRatings.join(", ")} (${row.reviewerCount})`}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatRating(row.meanReviewerRating)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.reviewerRatingSpread === null ? "—" : row.reviewerRatingSpread}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

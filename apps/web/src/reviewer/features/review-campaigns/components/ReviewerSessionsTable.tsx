import type { ReviewerSessionListItemDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
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
import { CheckCircle2Icon, CircleIcon, InboxIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { buildDate } from "@/common/utils/build-date"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"

const shortenId = (id: string) => `${id.slice(0, 8)}…`

export function ReviewerSessionsTable({ sessions }: { sessions: ReviewerSessionListItemDto[] }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)
  const handleOpen = (agentSessionId: string) => {
    navigate(
      ReviewerRoutes.session.build({
        organizationId,
        projectId,
        reviewCampaignId,
        agentSessionId,
      }),
    )
  }
  if (sessions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>{t("reviewerCampaigns:sessionsTable.empty.title")}</EmptyTitle>
          <EmptyDescription>
            {t("reviewerCampaigns:sessionsTable.empty.description")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("reviewerCampaigns:sessionsTable.headers.session")}</TableHead>
          <TableHead>{t("reviewerCampaigns:sessionsTable.headers.started")}</TableHead>
          <TableHead className="text-right">
            {t("reviewerCampaigns:sessionsTable.headers.messages")}
          </TableHead>
          <TableHead className="text-right">
            {t("reviewerCampaigns:sessionsTable.headers.reviewers")}
          </TableHead>
          <TableHead>{t("reviewerCampaigns:sessionsTable.headers.myReview")}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow key={session.sessionId}>
            <TableCell className="flex flex-col gap-1">
              <span className="font-mono text-xs">{shortenId(session.sessionId)}</span>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  {session.sessionType}
                </Badge>
                {session.callerIsSessionOwner && (
                  <Badge variant="secondary" className="text-xs">
                    {t("reviewerCampaigns:sessionsTable.yourSession")}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>{buildDate(session.startedAt)}</TableCell>
            <TableCell className="text-right">{session.messageCount}</TableCell>
            <TableCell className="text-right">{session.reviewerCount}</TableCell>
            <TableCell>
              {session.callerHasReviewed ? (
                <span className="flex items-center gap-1 text-sm">
                  <CheckCircle2Icon className="size-4 text-green-600" />{" "}
                  {t("reviewerCampaigns:sessionsTable.submitted")}
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1 text-sm">
                  <CircleIcon className="size-4" /> {t("reviewerCampaigns:sessionsTable.pending")}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant={session.callerIsSessionOwner ? "ghost" : "outline"}
                disabled={session.callerIsSessionOwner}
                onClick={() => handleOpen(session.sessionId)}
              >
                {session.callerHasReviewed
                  ? t("reviewerCampaigns:sessionsTable.view")
                  : t("reviewerCampaigns:sessionsTable.review")}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

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
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { CheckCircle2Icon, CircleIcon, InboxIcon } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { buildDate } from "@/common/utils/build-date"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"

const shortenId = (id: string) => `${id.slice(0, 8)}…`

export function ReviewerSessionsTable({ sessions }: { sessions: ReviewerSessionListItemDto[] }) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows when the sessions change.
  "use no memo"
  const navigate = useNavigate()
  const { t } = useTranslation()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)

  const columns = useMemo<ColumnDef<ReviewerSessionListItemDto>[]>(() => {
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
    return [
      {
        id: "session",
        header: () => t("reviewerCampaigns:sessionsTable.headers.session"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs">{shortenId(row.original.sessionId)}</span>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {row.original.agentType}
              </Badge>
              {row.original.callerIsSessionOwner && (
                <Badge variant="secondary" className="text-xs">
                  {t("reviewerCampaigns:sessionsTable.yourSession")}
                </Badge>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "started",
        header: () => t("reviewerCampaigns:sessionsTable.headers.started"),
        cell: ({ row }) => buildDate(row.original.startedAt),
      },
      {
        id: "messages",
        meta: { className: "text-right" } satisfies DataTableColumnMeta,
        header: () => t("reviewerCampaigns:sessionsTable.headers.messages"),
        cell: ({ row }) => <div className="text-right">{row.original.messageCount}</div>,
      },
      {
        id: "reviewers",
        meta: { className: "text-right" } satisfies DataTableColumnMeta,
        header: () => t("reviewerCampaigns:sessionsTable.headers.reviewers"),
        cell: ({ row }) => <div className="text-right">{row.original.reviewerCount}</div>,
      },
      {
        id: "myReview",
        header: () => t("reviewerCampaigns:sessionsTable.headers.myReview"),
        cell: ({ row }) =>
          row.original.callerHasReviewed ? (
            <span className="flex items-center gap-1 text-sm">
              <CheckCircle2Icon className="size-4 text-green-600" />{" "}
              {t("reviewerCampaigns:sessionsTable.submitted")}
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1 text-sm">
              <CircleIcon className="size-4" /> {t("reviewerCampaigns:sessionsTable.pending")}
            </span>
          ),
      },
      {
        id: "open",
        header: () => null,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              size="sm"
              variant={row.original.callerIsSessionOwner ? "ghost" : "outline"}
              disabled={row.original.callerIsSessionOwner}
              onClick={() => handleOpen(row.original.sessionId)}
            >
              {row.original.callerHasReviewed
                ? t("reviewerCampaigns:sessionsTable.view")
                : t("reviewerCampaigns:sessionsTable.review")}
            </Button>
          </div>
        ),
      },
    ]
  }, [t, navigate, organizationId, projectId, reviewCampaignId])

  const table = useReactTable({
    data: sessions,
    columns,
    getRowId: (session) => session.sessionId,
    getCoreRowModel: getCoreRowModel(),
  })

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

  // The empty state above replaces the whole table.
  return <DataTable table={table} empty={null} />
}

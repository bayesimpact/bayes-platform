import type {
  ReviewCampaignParamsDto,
  ReviewerSessionListItemOutputDto,
} from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Link } from "@tanstack/react-router"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { CheckCircle2Icon, CircleDashedIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { fullDateTimeOf } from "@/lib/format-time"
import { shortIdOf } from "@/lib/short-id"

const columnHelper = createColumnHelper<ReviewerSessionListItemOutputDto>()

const numeric = { headerClassName: "text-right", cellClassName: "text-right tabular-nums" }

/** The texts of the headers and cells, which the table translates. */
const reviewerSessionColumnLabels = {
  session: msg({ message: "Session", comment: "A tester's session with the agent" }),
  started: msg({ message: "Started", comment: "When a session started" }),
  messages: msg({ message: "Messages", comment: "How many messages a session holds" }),
  reviewers: msg({ message: "Reviews", comment: "How many reviews a session got" }),
  myReview: msg`My review`,
  yourSession: msg({
    message: "Your session",
    comment: "Marks a session the reviewer started as a tester",
  }),
  submitted: msg({ message: "Submitted", comment: "The reviewer gave their review of a session" }),
  pending: msg({ message: "To do", comment: "The reviewer did not review a session yet" }),
  review: msg({ message: "Review", comment: "The button that opens a session to review it" }),
  view: msg({
    message: "View",
    comment: "The button that opens a session the reviewer already reviewed",
  }),
} satisfies Record<string, MessageDescriptor>

/** The columns of the sessions to review; the last one opens the session. */
export function reviewerSessionColumnsOf({
  campaign,
  locale,
  translate,
  openLabel,
}: {
  campaign: ReviewCampaignParamsDto
  locale: string
  translate: (descriptor: MessageDescriptor) => string
  /** The name of the link that opens a session, by its short id. */
  openLabel: (session: ReviewerSessionListItemOutputDto) => string
}): ColumnDef<ReviewerSessionListItemOutputDto, unknown>[] {
  return [
    columnHelper.accessor("sessionId", {
      header: translate(reviewerSessionColumnLabels.session),
      cell: (context) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{shortIdOf(context.getValue())}</span>
          {context.row.original.callerIsSessionOwner ? (
            <Badge variant="secondary">{translate(reviewerSessionColumnLabels.yourSession)}</Badge>
          ) : null}
        </span>
      ),
      enableSorting: false,
    }) as ColumnDef<ReviewerSessionListItemOutputDto, unknown>,
    columnHelper.accessor("startedAt", {
      header: translate(reviewerSessionColumnLabels.started),
      cell: (context) => (
        <span className="text-muted-foreground">{fullDateTimeOf(context.getValue(), locale)}</span>
      ),
    }) as ColumnDef<ReviewerSessionListItemOutputDto, unknown>,
    columnHelper.accessor("messageCount", {
      header: translate(reviewerSessionColumnLabels.messages),
      meta: numeric,
    }) as ColumnDef<ReviewerSessionListItemOutputDto, unknown>,
    columnHelper.accessor("reviewerCount", {
      header: translate(reviewerSessionColumnLabels.reviewers),
      meta: numeric,
    }) as ColumnDef<ReviewerSessionListItemOutputDto, unknown>,
    columnHelper.accessor("callerHasReviewed", {
      header: translate(reviewerSessionColumnLabels.myReview),
      cell: (context) =>
        context.row.original.callerIsSessionOwner ? (
          <span className="text-muted-foreground">—</span>
        ) : context.getValue() ? (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2Icon aria-hidden className="size-4 text-primary" />
            {translate(reviewerSessionColumnLabels.submitted)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CircleDashedIcon aria-hidden className="size-4" />
            {translate(reviewerSessionColumnLabels.pending)}
          </span>
        ),
    }) as ColumnDef<ReviewerSessionListItemOutputDto, unknown>,
    columnHelper.display({
      id: "open",
      cell: (context) =>
        // A reviewer who also tests does not review their own session.
        context.row.original.callerIsSessionOwner ? null : (
          <Link
            to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/sessions/$sessionId"
            params={{ ...campaign, sessionId: context.row.original.sessionId }}
            aria-label={openLabel(context.row.original)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {translate(
              context.row.original.callerHasReviewed
                ? reviewerSessionColumnLabels.view
                : reviewerSessionColumnLabels.review,
            )}
          </Link>
        ),
      meta: { headerClassName: "w-24", cellClassName: "w-24 text-right" },
    }),
  ]
}

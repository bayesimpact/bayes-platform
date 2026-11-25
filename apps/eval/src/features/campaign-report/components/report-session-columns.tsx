import type { CampaignReportSessionOutputDto } from "@bayes-platform/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { meanRatingOf } from "@/lib/format-rating"
import { shortIdOf } from "@/lib/short-id"

const columnHelper = createColumnHelper<CampaignReportSessionOutputDto>()

const numeric = { headerClassName: "text-right", cellClassName: "text-right tabular-nums" }

/** The texts of the headers, which the table translates. */
const reportSessionColumnLabels = {
  session: msg({ message: "Session", comment: "A tester's session with the agent" }),
  started: msg({ message: "Started", comment: "When a session started" }),
  tester: msg({ message: "Tester", comment: "The rating the tester gave a session" }),
  reviewers: msg({ message: "Reviewers", comment: "The ratings the reviewers gave a session" }),
  meanReviewer: msg`Mean reviewer`,
  spread: msg({ message: "Spread", comment: "The highest reviewer rating minus the lowest" }),
} satisfies Record<string, MessageDescriptor>

/** The columns of the report's sessions: the tester's rating against the reviewers'. */
export function reportSessionColumnsOf({
  locale,
  translate,
}: {
  locale: string
  translate: (descriptor: MessageDescriptor) => string
}): ColumnDef<CampaignReportSessionOutputDto, unknown>[] {
  return [
    columnHelper.accessor("sessionId", {
      header: translate(reportSessionColumnLabels.session),
      cell: (context) => <span className="font-mono text-xs">{shortIdOf(context.getValue())}</span>,
      enableSorting: false,
    }) as ColumnDef<CampaignReportSessionOutputDto, unknown>,
    columnHelper.accessor("startedAt", {
      header: translate(reportSessionColumnLabels.started),
      cell: (context) => <TimeAgo moment={context.getValue()} />,
    }) as ColumnDef<CampaignReportSessionOutputDto, unknown>,
    columnHelper.accessor("testerRating", {
      header: translate(reportSessionColumnLabels.tester),
      cell: (context) => context.getValue() ?? "—",
      meta: numeric,
    }) as ColumnDef<CampaignReportSessionOutputDto, unknown>,
    columnHelper.accessor((session) => session.reviewerRatings.join(", "), {
      id: "reviewerRatings",
      header: translate(reportSessionColumnLabels.reviewers),
      cell: (context) => (context.getValue() === "" ? "—" : context.getValue()),
      enableSorting: false,
      meta: numeric,
    }) as ColumnDef<CampaignReportSessionOutputDto, unknown>,
    columnHelper.accessor("meanReviewerRating", {
      header: translate(reportSessionColumnLabels.meanReviewer),
      cell: (context) => meanRatingOf(context.getValue(), locale),
      meta: numeric,
    }) as ColumnDef<CampaignReportSessionOutputDto, unknown>,
    columnHelper.accessor("reviewerRatingSpread", {
      header: translate(reportSessionColumnLabels.spread),
      cell: (context) => context.getValue() ?? "—",
      meta: numeric,
    }) as ColumnDef<CampaignReportSessionOutputDto, unknown>,
  ]
}

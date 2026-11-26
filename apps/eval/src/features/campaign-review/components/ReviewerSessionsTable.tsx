import type {
  ReviewCampaignParamsDto,
  ReviewerSessionListItemOutputDto,
} from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { shortIdOf } from "@/lib/short-id"
import { reviewerSessionColumnsOf } from "./reviewer-session-columns"

export type ReviewerSessionsTableProps = {
  campaign: ReviewCampaignParamsDto
  sessions: ReviewerSessionListItemOutputDto[]
}

/** The testers' sessions of a campaign, newest first, with where the reviewer stands on each. */
export function ReviewerSessionsTable({ campaign, sessions }: ReviewerSessionsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const table = useReactTable({
    data: sessions,
    columns: reviewerSessionColumnsOf({
      campaign,
      translate: (descriptor) => i18n._(descriptor),
      openLabel: (session) => {
        const id = shortIdOf(session.sessionId)
        return session.callerHasReviewed ? t`View session ${id}` : t`Review session ${id}`
      },
    }),
    getRowId: (session) => session.sessionId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <DataTable table={table} empty={<Trans>No session yet: testers have not started any.</Trans>} />
  )
}

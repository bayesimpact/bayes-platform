import type { CampaignReportSessionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { reportSessionColumnsOf } from "./report-session-columns"

export type ReportSessionsTableProps = {
  sessions: CampaignReportSessionOutputDto[]
}

/** The sessions of a campaign, newest first: a header sorts them. */
export function ReportSessionsTable({ sessions }: ReportSessionsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { i18n } = useLingui()
  const table = useReactTable({
    data: sessions,
    columns: reportSessionColumnsOf({
      locale: i18n.locale,
      translate: (descriptor) => i18n._(descriptor),
    }),
    getRowId: (session) => session.sessionId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <DataTable
      table={table}
      empty={<Trans>No session yet: the table fills as testers start sessions.</Trans>}
    />
  )
}

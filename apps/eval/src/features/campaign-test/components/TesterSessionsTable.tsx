import type {
  ReviewCampaignParamsDto,
  TesterSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { testerSessionColumnsOf } from "./tester-session-columns"

export type TesterSessionsTableProps = {
  campaign: ReviewCampaignParamsDto
  sessions: TesterSessionOutputDto[]
  onGiveFeedback: (session: TesterSessionOutputDto) => void
  onDelete: (session: TesterSessionOutputDto) => void
}

/** The sessions a tester started, newest first, with the feedback they gave on each. */
export function TesterSessionsTable({
  campaign,
  sessions,
  onGiveFeedback,
  onDelete,
}: TesterSessionsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const table = useReactTable({
    data: sessions,
    columns: testerSessionColumnsOf({
      campaign,
      locale: i18n.locale,
      translate: (descriptor) => i18n._(descriptor),
      actions: {
        giveFeedbackLabel: (started) => t`Give feedback on the session of ${started}`,
        chatLabel: (started) => t`Chat in the session of ${started}`,
        viewLabel: (started) => t`View the session of ${started}`,
        deleteLabel: (started) => t`Delete the session of ${started}`,
        onGiveFeedback,
        onDelete,
      },
    }),
    getRowId: (session) => session.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <DataTable
      table={table}
      empty={
        <Trans>
          You have not started a session yet. Your sessions show here, with the feedback you gave on
          each.
        </Trans>
      }
    />
  )
}

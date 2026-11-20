import type {
  AgentParamsDto,
  ReviewCampaignListItemOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { campaignColumnsOf } from "./campaign-columns"

export type CampaignsTableProps = {
  agent: AgentParamsDto
  campaigns: ReviewCampaignListItemOutputDto[]
}

/** The review campaigns of an agent, newest first: a header sorts, a row opens its campaign. */
export function CampaignsTable({ agent, campaigns }: CampaignsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { i18n } = useLingui()
  const navigate = useNavigate()
  const table = useReactTable({
    data: campaigns,
    columns: campaignColumnsOf({
      agent,
      locale: i18n.locale,
      translate: (descriptor) => i18n._(descriptor),
    }),
    getRowId: (campaign) => campaign.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <DataTable
      table={table}
      empty={<Trans>No review campaign yet.</Trans>}
      onRowOpen={(row) =>
        void navigate({
          to: "/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId",
          params: { ...agent, reviewCampaignId: row.original.id },
        })
      }
    />
  )
}

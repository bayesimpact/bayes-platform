import type { ReviewCampaignDto } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { MegaphoneIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import { buildDate } from "@/common/utils/build-date"
import { CampaignStatusBadge } from "./CampaignStatusBadge"

type Props = {
  campaigns: ReviewCampaignDto[]
  membershipCountByCampaign?: Record<string, number>
  onEdit: (campaignId: string) => void
  onDelete: (campaignId: string) => void
  onCreate?: () => void
}

export function CampaignListTable({
  campaigns,
  membershipCountByCampaign = {},
  onEdit,
  onDelete,
  onCreate,
}: Props) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a campaign is added or deleted.
  "use no memo"
  const { t } = useTranslation()

  const columns = useMemo<ColumnDef<ReviewCampaignDto>[]>(
    () => [
      {
        id: "name",
        header: () => t("reviewCampaigns:table.name"),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: "status",
        header: () => t("reviewCampaigns:table.status"),
        cell: ({ row }) => <CampaignStatusBadge status={row.original.status} />,
      },
      {
        id: "members",
        header: () => t("reviewCampaigns:table.members"),
        cell: ({ row }) => membershipCountByCampaign[row.original.id] ?? 0,
      },
      {
        id: "created",
        header: () => t("reviewCampaigns:table.created"),
        cell: ({ row }) => buildDate(row.original.createdAt),
      },
      {
        id: "updated",
        header: () => t("reviewCampaigns:table.updated"),
        cell: ({ row }) => buildDate(row.original.updatedAt),
      },
      {
        id: "actions",
        meta: { className: "text-right" } satisfies DataTableColumnMeta,
        header: () => t("reviewCampaigns:table.actions"),
        cell: ({ row }) => {
          const campaign = row.original
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(campaign.id)}
                aria-label={t("reviewCampaigns:table.editAria", { name: campaign.name })}
              >
                <PencilIcon />
              </Button>
              {campaign.status === "draft" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(campaign.id)}
                  aria-label={t("reviewCampaigns:table.deleteAria", { name: campaign.name })}
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [t, membershipCountByCampaign, onEdit, onDelete],
  )

  const table = useReactTable({
    data: campaigns,
    columns,
    getRowId: (campaign) => campaign.id,
    getCoreRowModel: getCoreRowModel(),
  })

  if (campaigns.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MegaphoneIcon />
          </EmptyMedia>
          <EmptyTitle>{t("reviewCampaigns:empty.title")}</EmptyTitle>
          <EmptyDescription>{t("reviewCampaigns:empty.description")}</EmptyDescription>
        </EmptyHeader>
        {onCreate && <Button onClick={onCreate}>{t("reviewCampaigns:new")}</Button>}
      </Empty>
    )
  }

  // The empty state above replaces the whole table, with its call to create a campaign.
  return <DataTable table={table} empty={null} />
}

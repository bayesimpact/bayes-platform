import type { ReviewCampaignDto } from "@caseai-connect/api-contracts"
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
import { MegaphoneIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("reviewCampaigns:table.name")}</TableHead>
          <TableHead>{t("reviewCampaigns:table.status")}</TableHead>
          <TableHead>{t("reviewCampaigns:table.members")}</TableHead>
          <TableHead>{t("reviewCampaigns:table.created")}</TableHead>
          <TableHead>{t("reviewCampaigns:table.updated")}</TableHead>
          <TableHead className="text-right">{t("reviewCampaigns:table.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((campaign) => {
          const canDelete = campaign.status === "draft"
          return (
            <TableRow key={campaign.id}>
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>
                <CampaignStatusBadge status={campaign.status} />
              </TableCell>
              <TableCell>{membershipCountByCampaign[campaign.id] ?? 0}</TableCell>
              <TableCell>{buildDate(campaign.createdAt)}</TableCell>
              <TableCell>{buildDate(campaign.updatedAt)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(campaign.id)}
                    aria-label={t("reviewCampaigns:table.editAria", { name: campaign.name })}
                  >
                    <PencilIcon />
                  </Button>
                  {canDelete && (
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
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

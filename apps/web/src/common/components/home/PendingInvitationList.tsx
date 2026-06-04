import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CheckCircleIcon, InboxIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import { useAppDispatch } from "@/common/store/hooks"
import type {
  PendingInvitationItem as PendingInvitationEntry,
  PendingInvitations,
} from "@/studio/features/invitations/invitations.models"
import { acceptInvitation } from "@/studio/features/invitations/invitations.thunks"

export function PendingInvitationList({ invitations }: { invitations: PendingInvitations }) {
  const { t } = useTranslation()
  const total = invitations.length
  if (total === 0) return null
  return (
    <Grid cols={3} total={total}>
      <GridHeader
        className="bg-gray-50"
        title={t("me:invitations:title")}
        description={t("me:invitations:description")}
        action={
          <div className="flex gap-2">
            <Badge className="rounded-full">{total}</Badge>
            <InboxIcon className="text-muted-foreground" />
          </div>
        }
      />

      <GridContent>
        {invitations.map((invitation, index) => (
          <PendingInvitationRow key={invitation.id} invitation={invitation} index={index} />
        ))}
      </GridContent>
    </Grid>
  )
}

function PendingInvitationRow({
  invitation,
  index,
}: {
  invitation: PendingInvitationEntry
  index: number
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const handleClick = () => {
    dispatch(acceptInvitation({ ticketId: invitation.invitationToken }))
  }

  const badge =
    invitation.targetType === "project"
      ? t("me:invitations:projectBadge")
      : invitation.targetType === "agent"
        ? t("me:invitations:agentBadge")
        : t("me:invitations:reviewCampaignBadge")

  const description =
    invitation.targetType === "project"
      ? `${invitation.organizationName} · ${t("me:invitations:roleLabel")}: ${invitation.role}`
      : `${invitation.organizationName} · ${invitation.projectName} · ${t("me:invitations:roleLabel")}: ${invitation.role}`

  return (
    <GridItem
      index={index}
      badge={badge}
      title={invitation.targetName}
      description={description}
      action={
        <Button onClick={handleClick}>
          {t("actions:accept")} <CheckCircleIcon />
        </Button>
      }
    />
  )
}

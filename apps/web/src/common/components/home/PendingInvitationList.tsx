import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CheckCircleIcon, InboxIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
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
    <Grid cols={3}>
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
        {invitations.map((invitation) => (
          <PendingInvitationRow key={invitation.id} invitation={invitation} />
        ))}
      </GridContent>
    </Grid>
  )
}

function PendingInvitationRow({ invitation }: { invitation: PendingInvitationEntry }) {
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
    <GridCard>
      <GridCard.Badge>{badge}</GridCard.Badge>
      <GridCard.Body>
        <GridCard.Title>{invitation.targetName}</GridCard.Title>
        <GridCard.Description>{description}</GridCard.Description>
        <Button onClick={handleClick}>
          {t("actions:accept")} <CheckCircleIcon />
        </Button>
      </GridCard.Body>
    </GridCard>
  )
}

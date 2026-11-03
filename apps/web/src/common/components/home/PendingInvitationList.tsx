import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CheckCircleIcon, InboxIcon, XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import type {
  PendingInvitation,
  PendingInvitations,
} from "@/studio/features/invitations/invitations.models"

/** The invitations the signed-in person received, each accepted or declined at once. */
export function PendingInvitationList({
  invitations,
  onAccept,
  onDecline,
}: {
  invitations: PendingInvitations
  onAccept: (invitationId: string) => void
  onDecline: (invitationId: string) => void
}) {
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
          <PendingInvitationCard
            key={invitation.id}
            invitation={invitation}
            onAccept={onAccept}
            onDecline={onDecline}
          />
        ))}
      </GridContent>
    </Grid>
  )
}

const BADGE_KEYS = {
  project: "me:invitations:projectBadge",
  agent: "me:invitations:agentBadge",
  review_campaign: "me:invitations:reviewCampaignBadge",
} as const

/**
 * One invitation: what it is for, then a summary of what it gives, the same as the one its sender
 * confirmed.
 */
function PendingInvitationCard({
  invitation,
  onAccept,
  onDecline,
}: {
  invitation: PendingInvitation
  onAccept: (invitationId: string) => void
  onDecline: (invitationId: string) => void
}) {
  const { t } = useTranslation()
  const isWorkspace = invitation.targetType === "project"
  const where = isWorkspace
    ? invitation.organizationName
    : `${invitation.organizationName} · ${invitation.projectName}`
  const role = t(`projectMembership:roleNames.${invitation.targetType}_${invitation.role}`, {
    defaultValue: invitation.role,
  })
  const agents =
    invitation.role === "admin"
      ? t("me:invitations:everyAgent")
      : invitation.agents.map((agent) => agent.name).join(", ")

  return (
    <GridCard>
      <GridCard.Body className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <GridCard.Title>{invitation.targetName}</GridCard.Title>
            <p className="mt-1 text-muted-foreground">{where}</p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {t(BADGE_KEYS[invitation.targetType])}
          </Badge>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <dt className="text-muted-foreground">{t("me:invitations:roleLabel")}</dt>
          <dd className="font-medium">{role}</dd>
          {isWorkspace && agents && (
            <>
              <dt className="text-muted-foreground">{t("me:invitations:agentsLabel")}</dt>
              <dd>{agents}</dd>
            </>
          )}
        </dl>

        <div className="flex gap-2">
          <Button onClick={() => onAccept(invitation.id)}>
            {t("actions:accept")} <CheckCircleIcon />
          </Button>
          <Button variant="outline" onClick={() => onDecline(invitation.id)}>
            {t("actions:decline")} <XIcon />
          </Button>
        </div>
      </GridCard.Body>
    </GridCard>
  )
}

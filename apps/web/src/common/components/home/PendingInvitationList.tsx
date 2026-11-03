import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CheckCircleIcon, InboxIcon, XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { useAppDispatch } from "@/common/store/hooks"
import type {
  PendingInvitation,
  PendingInvitations,
} from "@/studio/features/invitations/invitations.models"
import {
  acceptInvitation,
  declineInvitation,
} from "@/studio/features/invitations/invitations.thunks"

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

function PendingInvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  const badge =
    invitation.targetType === "project"
      ? t("me:invitations:projectBadge")
      : invitation.targetType === "agent"
        ? t("me:invitations:agentBadge")
        : t("me:invitations:reviewCampaignBadge")

  const description =
    invitation.targetType === "project"
      ? invitation.organizationName
      : `${invitation.organizationName} · ${invitation.projectName} · ${t("me:invitations:roleLabel")}: ${invitation.role}`

  return (
    <GridCard>
      <GridCard.Badge>{badge}</GridCard.Badge>
      <GridCard.Body>
        <GridCard.Title>{invitation.targetName}</GridCard.Title>
        <GridCard.Description>{description}</GridCard.Description>
        {invitation.targetType === "project" && (
          <WorkspaceInvitationAccess invitation={invitation} />
        )}
        <div className="flex gap-2">
          <Button onClick={() => dispatch(acceptInvitation({ invitationId: invitation.id }))}>
            {t("actions:accept")} <CheckCircleIcon />
          </Button>
          <Button
            variant="outline"
            onClick={() => dispatch(declineInvitation({ invitationId: invitation.id }))}
          >
            {t("actions:decline")} <XIcon />
          </Button>
        </div>
      </GridCard.Body>
    </GridCard>
  )
}

/** Above this many agents, the card shows the first ones and a count of the others. */
const VISIBLE_AGENT_COUNT = 6

/** Everything a workspace invitation gives, accepted at once: the role, then the agents. */
function WorkspaceInvitationAccess({ invitation }: { invitation: PendingInvitation }) {
  const { t } = useTranslation()
  const role = t(`projectMembership:roleNames.project_${invitation.role}`, {
    defaultValue: invitation.role,
  })
  const visibleAgents = invitation.agents.slice(0, VISIBLE_AGENT_COUNT)
  const hiddenAgents = invitation.agents.slice(VISIBLE_AGENT_COUNT)
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>{t("me:invitations:joinAs", { role: role.toLowerCase() })}</p>
      {invitation.role === "admin" ? (
        <p className="text-muted-foreground">{t("me:invitations:everyAgent")}</p>
      ) : (
        invitation.agents.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-muted-foreground">{t("me:invitations:agentsLabel")}</span>
            {visibleAgents.map((agent) => (
              <Badge key={agent.id} variant="outline">
                {agent.name}
              </Badge>
            ))}
            {hiddenAgents.length > 0 && (
              <Badge
                variant="outline"
                title={hiddenAgents.map((agent) => agent.name).join(", ")}
                className="text-muted-foreground"
              >
                +{hiddenAgents.length}
              </Badge>
            )}
          </div>
        )
      )}
    </div>
  )
}

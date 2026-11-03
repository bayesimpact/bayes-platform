import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CheckIcon, LinkIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { buildInvitationLink } from "@/common/auth/login-hint"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { buildSince } from "@/common/utils/build-date"
import type { PendingInvitation, PendingInvitations } from "../invitations.models"

/** Above this many agents, a card shows the first ones and a count of the others. */
const VISIBLE_AGENT_COUNT = 2

/** The agent whose page lists the invitations, if any. */
type CurrentAgent = { id: string; name: string }

/**
 * The pending invitations of a workspace or of an agent. On an agent, a workspace invitation that
 * gives the agent shows too, and its delete button takes only this agent out of it.
 */
export function PendingInvitationsSection({
  invitations,
  title,
  description,
  currentAgent,
  onRevoke,
}: {
  invitations: PendingInvitations
  title: string
  description: string
  currentAgent?: CurrentAgent
  onRevoke: (invitationId: string) => void
}) {
  const { t } = useTranslation()
  if (invitations.length === 0) return null

  return (
    <section className="border-t px-6 py-5 bg-muted/35">
      <div className="mb-4">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("invitations:pendingSection.signInHint")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {invitations.map((invitation) => (
          <PendingInvitationCard
            key={invitation.id}
            invitation={invitation}
            currentAgent={currentAgent}
            onRevoke={onRevoke}
          />
        ))}
      </div>
    </section>
  )
}

function PendingInvitationCard({
  invitation,
  currentAgent,
  onRevoke,
}: {
  invitation: PendingInvitation
  currentAgent?: CurrentAgent
  onRevoke: (invitationId: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { copy, isCopied } = useCopyToClipboard(t("invitations:pendingItem.linkCopied"))
  const label = invitation.invitedEmail
  // On an agent's page, a workspace invitation loses only this agent.
  const removesAgentOnly = currentAgent !== undefined && invitation.targetType === "project"
  const revokeLabel = removesAgentOnly
    ? t("invitations:pendingItem.removeAgent")
    : t("invitations:pendingItem.revoke")

  const handleConfirm = () => {
    onRevoke(invitation.id)
    setOpen(false)
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-white p-4">
      <div className="min-w-0 flex-1">
        <p className="break-all text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("invitations:pendingItem.description", {
            invitedAt: buildSince(invitation.invitedAt),
          })}
        </p>
        {invitation.targetType === "project" &&
          (currentAgent ? (
            <WorkspaceInvitationHint invitation={invitation} currentAgent={currentAgent} />
          ) : (
            <WorkspaceInvitationAccess invitation={invitation} />
          ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground"
        aria-label={t("invitations:pendingItem.copyLink")}
        title={t("invitations:pendingItem.copyLink")}
        onClick={() => copy(buildInvitationLink(invitation.invitedEmail))}
      >
        {isCopied ? <CheckIcon className="size-4" /> : <LinkIcon className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={revokeLabel}
        title={revokeLabel}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        title={
          removesAgentOnly
            ? t("invitations:removeAgentDialog.title")
            : t("invitations:deleteDialog.title")
        }
        description={
          removesAgentOnly
            ? t("invitations:removeAgentDialog.description", {
                email: label,
                agentName: currentAgent.name,
              })
            : t("invitations:deleteDialog.description", { email: label })
        }
        confirmLabel={t("actions:confirm")}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}

/** What a workspace invitation gives: its role, then its agents, or every agent for an admin. */
function WorkspaceInvitationAccess({ invitation }: { invitation: PendingInvitation }) {
  const { t } = useTranslation()
  const visibleAgents = invitation.agents.slice(0, VISIBLE_AGENT_COUNT)
  const hiddenAgents = invitation.agents.slice(VISIBLE_AGENT_COUNT)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <Badge variant="secondary">
        {t(`projectMembership:roleNames.project_${invitation.role}`, {
          defaultValue: invitation.role,
        })}
      </Badge>
      {invitation.role === "admin" ? (
        <span className="text-xs text-muted-foreground">
          {t("invitations:pendingItem.everyAgent")}
        </span>
      ) : (
        <>
          {visibleAgents.map((agent) => (
            <Badge key={agent.id} variant="outline" className="max-w-40">
              <span className="truncate">{agent.name}</span>
            </Badge>
          ))}
          {hiddenAgents.length > 0 && (
            <Badge
              variant="outline"
              title={hiddenAgents.map((agent) => agent.name).join(", ")}
              className="text-muted-foreground"
            >
              {t("invitations:pendingItem.moreAgents", { count: hiddenAgents.length })}
            </Badge>
          )}
        </>
      )}
    </div>
  )
}

/** On an agent's page: the invitation comes from the workspace, and may give other agents. */
function WorkspaceInvitationHint({
  invitation,
  currentAgent,
}: {
  invitation: PendingInvitation
  currentAgent: CurrentAgent
}) {
  const { t } = useTranslation()
  const otherAgentCount = invitation.agents.filter((agent) => agent.id !== currentAgent.id).length
  const role = t(`projectMembership:roleNames.project_${invitation.role}`, {
    defaultValue: invitation.role,
  })
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {t("invitations:pendingItem.fromWorkspace", { role: role.toLowerCase() })}
      {otherAgentCount > 0 && (
        <>
          <br />
          {t("invitations:pendingItem.otherAgents", { count: otherAgentCount })}
        </>
      )}
    </p>
  )
}

import { Button } from "@caseai-connect/ui/shad/button"
import { CheckIcon, LinkIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { buildInvitationLink } from "@/common/auth/login-hint"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { buildSince } from "@/common/utils/build-date"
import type { PendingInvitation, PendingInvitations } from "../invitations.models"

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
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("invitations:pendingItem.description", {
              invitedAt: buildSince(invitation.invitedAt),
            })}
          </p>
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
      </div>
      <InvitationSummary invitation={invitation} />
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

/**
 * What the invitation gives, as the manager confirmed it: the role, then the agents of a
 * workspace invitation, or every agent for an admin.
 */
function InvitationSummary({ invitation }: { invitation: PendingInvitation }) {
  const { t } = useTranslation()
  const role = t(`projectMembership:roleNames.${invitation.targetType}_${invitation.role}`, {
    defaultValue: invitation.role,
  })
  const agents =
    invitation.targetType !== "project"
      ? ""
      : invitation.role === "admin"
        ? t("invitations:confirmation.everyAgent")
        : invitation.agents.map((agent) => agent.name).join(", ")
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
      <dt className="text-muted-foreground">
        {invitation.targetType === "project"
          ? t("invitations:confirmation.workspaceRole")
          : t("invitations:confirmation.role")}
      </dt>
      <dd className="font-medium">{role}</dd>
      {agents && (
        <>
          <dt className="text-muted-foreground">{t("invitations:confirmation.agents")}</dt>
          <dd>{agents}</dd>
        </>
      )}
    </dl>
  )
}

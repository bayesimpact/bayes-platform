import { Button } from "@caseai-connect/ui/shad/button"
import { CheckIcon, LinkIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { buildInvitationLink } from "@/common/auth/login-hint"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { buildSince } from "@/common/utils/build-date"
import type { PendingInvitation, PendingInvitations } from "../invitations.models"

export function PendingInvitationsSection({
  invitations,
  title,
  description,
  onRevoke,
}: {
  invitations: PendingInvitations
  title: string
  description: string
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
          <PendingInvitationCard key={invitation.id} invitation={invitation} onRevoke={onRevoke} />
        ))}
      </div>
    </section>
  )
}

function PendingInvitationCard({
  invitation,
  onRevoke,
}: {
  invitation: PendingInvitation
  onRevoke: (invitationId: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { copy, isCopied } = useCopyToClipboard(t("invitations:pendingItem.linkCopied"))
  const label = invitation.invitedEmail

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
        aria-label={t("invitations:pendingItem.revoke")}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        title={t("invitations:deleteDialog.title")}
        description={t("invitations:deleteDialog.description", { email: label })}
        confirmLabel={t("actions:confirm")}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}

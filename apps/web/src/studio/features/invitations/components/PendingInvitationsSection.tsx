import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { buildSince } from "@/common/utils/build-date"
import type { PendingInvitationItem, PendingInvitations } from "../invitations.models"

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
  if (invitations.length === 0) return null

  return (
    <section className="border-t px-6 py-5">
      <div className="mb-4">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
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
  invitation: PendingInvitationItem
  onRevoke: (invitationId: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const label = invitation.invitedEmail ?? invitation.targetName

  const handleConfirm = () => {
    onRevoke(invitation.id)
    setOpen(false)
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/10 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={label}>
          {label}
        </p>
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

import type {
  CampaignInvitationOutputDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { reviewCampaignRoleSchema } from "@caseai-connect/eval-contracts"
import { RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, useNow } from "@caseai-connect/frontend-lib"
import { Trans, useLingui } from "@lingui/react/macro"
import { CopyIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { RelativeTime } from "@/components/shared/RelativeTime"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useRevokeInvitation } from "../api/mutations"
import { CampaignRoleLabel } from "./CampaignRoleLabel"

export type PendingInvitationsProps = {
  campaign: ReviewCampaignParamsDto
  invitations: CampaignInvitationOutputDto[]
}

/**
 * The link an invited person opens: the platform's home, which asks them to sign in with the
 * invited address and shows their invitation. It holds no secret.
 */
function invitationLinkOf(email: string): string {
  const link = new URL("/", window.location.origin)
  link.searchParams.set("login_hint", email)
  return link.toString()
}

/** The invitations that wait for an answer: copy a person's link, or take the invitation back. */
export function PendingInvitations({ campaign, invitations }: PendingInvitationsProps) {
  const { t } = useLingui()
  const now = useNow(RELATIVE_TIME_INTERVAL_IN_MILLISECONDS, invitations.length > 0)
  const [deleting, setDeleting] = useState<CampaignInvitationOutputDto | null>(null)
  const revokeInvitation = useRevokeInvitation(campaign)
  const deletedEmail = deleting?.invitedEmail ?? ""

  const handleCopy = async (email: string) => {
    try {
      await navigator.clipboard.writeText(invitationLinkOf(email))
      toast.success(t`The invitation link was copied.`)
    } catch {
      toast.error(t`The link could not be copied.`)
    }
  }

  return (
    <>
      <ul className="flex flex-col divide-y rounded-lg border">
        {invitations.map((invitation) => {
          const email = invitation.invitedEmail
          const role = reviewCampaignRoleSchema.safeParse(invitation.role)
          return (
            <li key={invitation.id} className="flex items-center gap-1 py-2.5 pr-2 pl-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium wrap-anywhere">{email}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {role.success ? (
                    <Badge variant="outline">
                      <CampaignRoleLabel campaignRole={role.data} />
                    </Badge>
                  ) : null}
                  <span className="whitespace-nowrap text-muted-foreground">
                    <Trans comment="When a person was invited, such as: Invited 5 minutes ago">
                      Invited <RelativeTime moment={invitation.invitedAt} now={now} />
                    </Trans>
                  </span>
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t`Copy the invitation link of ${email}`}
                      onClick={() => void handleCopy(email)}
                    >
                      <CopyIcon aria-hidden />
                    </Button>
                  }
                />
                <TooltipContent>
                  <Trans>Copy the invitation link</Trans>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t`Delete the invitation of ${email}`}
                      onClick={() => setDeleting(invitation)}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  }
                />
                <TooltipContent>
                  <Trans>Delete the invitation</Trans>
                </TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleting(null)
        }}
        title={<Trans>Delete this invitation?</Trans>}
        description={<Trans>{deletedEmail} will no longer be able to accept it.</Trans>}
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={revokeInvitation.isPending}
        onConfirm={() => {
          if (!deleting) return
          revokeInvitation.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: () => toast.error(t`The invitation could not be deleted. Try again.`),
          })
        }}
      />
    </>
  )
}

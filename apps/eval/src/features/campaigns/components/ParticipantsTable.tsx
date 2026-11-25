import type { ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { useRevokeMembership } from "../api/mutations"
import type { Participant } from "../participants"
import { participantColumnsOf } from "./participant-columns"

export type ParticipantsTableProps = {
  campaign: ReviewCampaignParamsDto
  participants: Participant[]
  /** Whether the person may take a role away, and the campaign still takes changes. */
  canRevoke: boolean
}

/** The testers and reviewers of a campaign, one row per role, each revoked after a confirmation. */
export function ParticipantsTable({ campaign, participants, canRevoke }: ParticipantsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const [revoking, setRevoking] = useState<Participant | null>(null)
  const revokeMembership = useRevokeMembership(campaign)
  const table = useReactTable({
    data: participants,
    columns: participantColumnsOf({
      translate: (descriptor) => i18n._(descriptor),
      renderActions: canRevoke
        ? (participant) => {
            const email = participant.email
            return (
              <Button
                variant="outline"
                size="sm"
                aria-label={t`Revoke ${email}`}
                onClick={() => setRevoking(participant)}
              >
                <Trans comment="Takes a participant out of a review campaign">Revoke</Trans>
              </Button>
            )
          }
        : null,
    }),
    getRowId: (participant) => participant.membershipId,
    getCoreRowModel: getCoreRowModel(),
  })
  const revokedEmail = revoking?.email ?? ""

  return (
    <>
      <DataTable table={table} empty={<Trans>No participant yet.</Trans>} />
      <ConfirmDialog
        isOpen={revoking !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRevoking(null)
        }}
        title={<Trans>Revoke {revokedEmail}?</Trans>}
        description={
          <Trans>
            This person loses this role in the campaign. What they already submitted stays.
          </Trans>
        }
        confirmLabel={<Trans comment="Takes a participant out of a review campaign">Revoke</Trans>}
        isDestructive
        isPending={revokeMembership.isPending}
        onConfirm={() => {
          if (!revoking) return
          revokeMembership.mutate(revoking.membershipId, {
            onSuccess: () => {
              setRevoking(null)
              toast.success(t`${revokedEmail} was revoked.`)
            },
            onError: () => toast.error(t`${revokedEmail} could not be revoked. Try again.`),
          })
        }}
      />
    </>
  )
}

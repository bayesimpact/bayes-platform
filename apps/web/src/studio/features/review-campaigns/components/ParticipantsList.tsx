import type {
  ReviewCampaignMembershipDto,
  ReviewCampaignMembershipRole,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import { NeverSignedInBadge } from "@/common/components/NeverSignedInBadge"
import { PendingInvitationsSection } from "@/studio/features/invitations/components/PendingInvitationsSection"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"

/** One row per role: a person who is both tester and reviewer has two, each revoked on its own. */
type ParticipantRow = Omit<ReviewCampaignMembershipDto, "roles"> & {
  /** The row holding this role, which revoking deletes. */
  membershipId: string
  role: ReviewCampaignMembershipRole
}

const toParticipantRows = (memberships: ReviewCampaignMembershipDto[]): ParticipantRow[] =>
  memberships.flatMap(({ roles, ...membership }) =>
    roles.flatMap((role): ParticipantRow[] => {
      if (role.key === "review_campaign_tester") {
        return [{ ...membership, membershipId: role.membershipId, role: "tester" }]
      }
      if (role.key === "review_campaign_reviewer") {
        return [{ ...membership, membershipId: role.membershipId, role: "reviewer" }]
      }
      return []
    }),
  )

type Props = {
  memberships: ReviewCampaignMembershipDto[]
  pendingInvitations: PendingInvitations
  onInvite: (role: ReviewCampaignMembershipRole, emails: string[]) => void
  onRevoke: (membershipId: string) => void
  onRevokeInvitation: (invitationId: string) => void
  disabled?: boolean
}

const parseEmails = (raw: string): string[] =>
  raw
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean)

export function ParticipantsList({
  memberships,
  pendingInvitations,
  onInvite,
  onRevoke,
  onRevokeInvitation,
  disabled = false,
}: Props) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after an invitation or a revocation.
  "use no memo"
  const { t } = useTranslation()
  const [emailsInput, setEmailsInput] = useState("")
  const [role, setRole] = useState<ReviewCampaignMembershipRole>("tester")
  const [confirmRevokeMembership, setConfirmRevokeMembership] = useState<ParticipantRow | null>(
    null,
  )
  const participantRows = useMemo(() => toParticipantRows(memberships), [memberships])

  const columns = useMemo<ColumnDef<ParticipantRow>[]>(() => {
    const roleLabel = (membershipRole: ReviewCampaignMembershipRole): string =>
      membershipRole === "tester"
        ? t("reviewCampaigns:participants.tester")
        : t("reviewCampaigns:participants.reviewer")
    return [
      {
        id: "email",
        header: () => t("reviewCampaigns:participants.email"),
        cell: ({ row }) => <span className="font-medium">{row.original.userEmail}</span>,
      },
      {
        id: "role",
        header: () => t("reviewCampaigns:participants.roleLabel"),
        cell: ({ row }) => <Badge variant="outline">{roleLabel(row.original.role)}</Badge>,
      },
      {
        id: "status",
        header: () => t("reviewCampaigns:participants.status"),
        cell: ({ row }) => (!row.original.userHasSignedIn ? <NeverSignedInBadge /> : null),
      },
      {
        id: "actions",
        meta: { className: "text-right" } satisfies DataTableColumnMeta,
        header: () => t("reviewCampaigns:participants.actions"),
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => setConfirmRevokeMembership(row.original)}
            >
              {t("reviewCampaigns:participants.revoke")}
            </Button>
          </div>
        ),
      },
    ]
  }, [t, disabled])

  const table = useReactTable({
    data: participantRows,
    columns,
    getRowId: (membership) => membership.membershipId,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleInvite = () => {
    const emails = parseEmails(emailsInput)
    if (emails.length === 0) return
    onInvite(role, emails)
    setEmailsInput("")
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border p-3">
        <h3 className="text-sm font-semibold">{t("reviewCampaigns:participants.inviteTitle")}</h3>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field className="md:flex-1">
            <FieldLabel htmlFor="invite-emails">
              {t("reviewCampaigns:participants.emailsLabel")}
            </FieldLabel>
            <Textarea
              id="invite-emails"
              rows={3}
              value={emailsInput}
              disabled={disabled}
              placeholder={t("reviewCampaigns:participants.emailsPlaceholder")}
              onChange={(event) => setEmailsInput(event.target.value)}
            />
          </Field>
          <Field className="md:w-40">
            <FieldLabel htmlFor="invite-role">
              {t("reviewCampaigns:participants.roleLabel")}
            </FieldLabel>
            <Select
              value={role}
              disabled={disabled}
              onValueChange={(value) => setRole(value as ReviewCampaignMembershipRole)}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tester">{t("reviewCampaigns:participants.tester")}</SelectItem>
                <SelectItem value="reviewer">
                  {t("reviewCampaigns:participants.reviewer")}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleInvite}
            disabled={disabled || parseEmails(emailsInput).length === 0}
          >
            {t("reviewCampaigns:participants.send")}
          </Button>
        </div>
      </div>

      <DataTable
        table={table}
        empty={
          <p className="text-muted-foreground text-sm italic">
            {t("reviewCampaigns:participants.empty")}
          </p>
        }
      />
      {pendingInvitations.length > 0 && (
        // Boxed like the table above; the section's own top border would double the box's.
        <div className="overflow-hidden rounded-md border [&>section]:border-t-0">
          <PendingInvitationsSection
            invitations={pendingInvitations}
            title={t("reviewCampaigns:participants.pendingInvitations.title")}
            description={t("reviewCampaigns:participants.pendingInvitations.description")}
            onRevoke={onRevokeInvitation}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmRevokeMembership !== null}
        title={t("reviewCampaigns:participants.revokeDialog.title", {
          email: confirmRevokeMembership?.userEmail,
        })}
        description={t("reviewCampaigns:participants.revokeDialog.description")}
        confirmLabel={t("reviewCampaigns:participants.revokeDialog.confirm")}
        onConfirm={() => {
          if (confirmRevokeMembership) onRevoke(confirmRevokeMembership.membershipId)
          setConfirmRevokeMembership(null)
        }}
        onCancel={() => setConfirmRevokeMembership(null)}
      />
    </section>
  )
}

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PendingInvitationsSection } from "@/studio/features/invitations/components/PendingInvitationsSection"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"

type Props = {
  memberships: ReviewCampaignMembershipDto[]
  pendingInvitations: PendingInvitations
  onInvite: (role: ReviewCampaignMembershipRole, emails: string[]) => void
  onRevoke: (membershipId: string) => void
  onRevokeInvitation: (invitationId: string) => void
  disabled?: boolean
}

const formatDate = (millis: number): string =>
  new Date(millis).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

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
  const { t } = useTranslation()
  const [emailsInput, setEmailsInput] = useState("")
  const [role, setRole] = useState<ReviewCampaignMembershipRole>("tester")

  const roleLabel = (membershipRole: ReviewCampaignMembershipRole): string =>
    membershipRole === "tester"
      ? t("reviewCampaigns:participants.tester")
      : t("reviewCampaigns:participants.reviewer")

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

      <div className="rounded-md border">
        {memberships.length === 0 ? (
          <p className="p-4 text-muted-foreground text-sm italic">
            {t("reviewCampaigns:participants.empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reviewCampaigns:participants.email")}</TableHead>
                <TableHead>{t("reviewCampaigns:participants.roleLabel")}</TableHead>
                <TableHead>{t("reviewCampaigns:participants.accepted")}</TableHead>
                <TableHead className="text-right">
                  {t("reviewCampaigns:participants.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((membership) => (
                <TableRow key={membership.id}>
                  <TableCell className="font-medium">{membership.userEmail}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{roleLabel(membership.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    {membership.acceptedAt ? (
                      formatDate(membership.acceptedAt)
                    ) : (
                      <span className="text-muted-foreground text-sm italic">
                        {t("reviewCampaigns:participants.pending")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onRevoke(membership.id)}
                    >
                      {t("reviewCampaigns:participants.revoke")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <PendingInvitationsSection
          invitations={pendingInvitations}
          title={t("reviewCampaigns:participants.pendingInvitations.title")}
          description={t("reviewCampaigns:participants.pendingInvitations.description")}
          onRevoke={onRevokeInvitation}
        />
      </div>
    </section>
  )
}

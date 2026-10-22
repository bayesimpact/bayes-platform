import type { InvitationOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { RelativeTime } from "@/components/shared/RelativeTime"
import { Button } from "@/components/ui/button"
import type { InvitationAnswer } from "../api/mutations"

export type InvitationItemProps = {
  invitation: InvitationOutputDto
  /** The time the list shows, for the invitation's age. */
  now: number
  isAnswering: boolean
  onAnswer: (answer: InvitationAnswer) => void
}

/** One pending invitation: what it opens, where, with which role, and the two answers. */
export function InvitationItem({ invitation, now, isAnswering, onAnswer }: InvitationItemProps) {
  const { t } = useLingui()
  const targetLabels = {
    project: t({ message: "Project", comment: "What an invitation gives access to" }),
    agent: t({ message: "Agent", comment: "What an invitation gives access to" }),
    review_campaign: t({
      message: "Review campaign",
      comment: "What an invitation gives access to",
    }),
  }
  const roleLabels: Record<string, string> = {
    owner: t({ message: "owner", comment: "The role an invitation grants" }),
    admin: t({ message: "admin", comment: "The role an invitation grants" }),
    member: t({ message: "member", comment: "The role an invitation grants" }),
    tester: t({ message: "tester", comment: "The role an invitation grants" }),
    reviewer: t({ message: "reviewer", comment: "The role an invitation grants" }),
  }
  const role = roleLabels[invitation.role] ?? invitation.role
  const name = invitation.targetName
  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm font-medium" title={name}>
          {name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {targetLabels[invitation.targetType]} · {invitation.projectName} ·{" "}
          {invitation.organizationName}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Trans>As {role}</Trans>
          <span aria-hidden>·</span>
          <RelativeTime moment={invitation.invitedAt} now={now} />
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isAnswering}
          onClick={() => onAnswer("accept")}
          aria-label={t`Accept the invitation to ${name}`}
        >
          <Trans>Accept</Trans>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={isAnswering}
          onClick={() => onAnswer("decline")}
          aria-label={t`Decline the invitation to ${name}`}
        >
          <Trans>Decline</Trans>
        </Button>
      </div>
    </li>
  )
}

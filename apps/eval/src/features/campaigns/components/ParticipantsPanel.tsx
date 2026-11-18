import {
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION,
  type ReviewCampaignDetailOutputDto,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { SectionCard } from "@/components/shared/SectionCard"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { campaignInvitationsQueryOptions } from "../api/queries"
import { listParticipants } from "../participants"
import { InviteParticipantsForm } from "./InviteParticipantsForm"
import { ParticipantsTable } from "./ParticipantsTable"
import { PendingInvitations } from "./PendingInvitations"

export type ParticipantsPanelProps = {
  agent: EvaluationAgent
  campaign: ReviewCampaignDetailOutputDto
  campaignParams: ReviewCampaignParamsDto
}

/**
 * The people of a campaign: invite them while it is active, see who answered, and take a role
 * back. A draft invites nobody yet, since nobody could accept.
 */
export function ParticipantsPanel({ agent, campaign, campaignParams }: ParticipantsPanelProps) {
  const isActive = campaign.status === "active"
  const canInvite =
    isActive &&
    hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION)
  const canRevoke =
    isActive &&
    hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION)
  // useQuery: only who may invite reads the invitations, and the panel shows without them.
  const { data: invitations = [] } = useQuery({
    ...campaignInvitationsQueryOptions(campaignParams),
    enabled: canInvite,
  })

  if (campaign.status === "draft") {
    return (
      <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
        <Trans>
          Activate the campaign to invite testers and reviewers: they can accept an invitation only
          once it is active.
        </Trans>
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {canInvite ? (
        <SectionCard
          title={<Trans>Invite participants</Trans>}
          description={
            <Trans>
              Each person gets an invitation to accept. They must sign in with the address you write
              here.
            </Trans>
          }
        >
          <InviteParticipantsForm campaign={campaignParams} />
        </SectionCard>
      ) : null}
      {invitations.length > 0 ? (
        <SectionCard
          title={<Trans>Pending invitations</Trans>}
          description={<Trans>People invited to this campaign who have not answered yet.</Trans>}
        >
          <PendingInvitations campaign={campaignParams} invitations={invitations} />
        </SectionCard>
      ) : null}
      <SectionCard title={<Trans>Participants</Trans>}>
        <ParticipantsTable
          campaign={campaignParams}
          participants={listParticipants(campaign.memberships)}
          canRevoke={canRevoke}
        />
      </SectionCard>
    </div>
  )
}

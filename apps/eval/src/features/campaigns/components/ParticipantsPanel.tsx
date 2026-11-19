import {
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION,
  type ReviewCampaignDetailOutputDto,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
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
/** The cards of the participants: larger titles, which set the blocks apart. */
const PARTICIPANTS_CARD = "[&_h2]:text-base"

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

  const participants = listParticipants(campaign.memberships)
  const reviewerCount = participants.filter((participant) => participant.role === "reviewer").length
  const testerCount = participants.filter((participant) => participant.role === "tester").length

  if (campaign.status === "draft") {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
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
          className={PARTICIPANTS_CARD}
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
          className={PARTICIPANTS_CARD}
          title={<Trans>Pending invitations</Trans>}
          description={<Trans>People invited to this campaign who have not answered yet.</Trans>}
        >
          <PendingInvitations campaign={campaignParams} invitations={invitations} />
        </SectionCard>
      ) : null}
      {/* The table has its own frame: the block of the participants needs none around it. */}
      <SectionCard
        className="rounded-none border-0 bg-transparent p-0 md:p-0 dark:bg-transparent [&_h2]:text-base"
        title={<Trans>Participants</Trans>}
        description={
          <>
            <Plural value={reviewerCount} one="# reviewer" other="# reviewers" />
            {" · "}
            <Plural value={testerCount} one="# tester" other="# testers" />
          </>
        }
      >
        <ParticipantsTable
          campaign={campaignParams}
          participants={participants}
          canRevoke={canRevoke}
        />
      </SectionCard>
    </div>
  )
}

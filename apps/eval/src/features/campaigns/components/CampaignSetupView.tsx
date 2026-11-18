import type { ReviewCampaignDetailOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { SectionCard } from "@/components/shared/SectionCard"
import { FeedbackFormPreview } from "./FeedbackFormPreview"

export type CampaignSetupViewProps = {
  campaign: ReviewCampaignDetailOutputDto
  agentName: string
}

/**
 * The setup of a campaign that no longer changes: what it is, then its three forms as its testers
 * and reviewers fill them, folded to their title and question count until opened.
 */
export function CampaignSetupView({ campaign, agentName }: CampaignSetupViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title={<Trans comment="The general settings of a review campaign">General</Trans>}
        description={<Trans>This campaign reviews the agent {agentName}.</Trans>}
      >
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">
            <Trans comment="The name of a review campaign">Name</Trans>
          </dt>
          <dd className="font-medium">{campaign.name}</dd>
          <dt className="text-muted-foreground">
            <Trans>Description</Trans>
          </dt>
          <dd className="whitespace-pre-line">
            {campaign.description || (
              <span className="text-muted-foreground italic">
                <Trans>No description</Trans>
              </span>
            )}
          </dd>
        </dl>
      </SectionCard>
      <FeedbackFormPreview
        title={<Trans>After each session</Trans>}
        description={<Trans>What a tester fills when they end a session.</Trans>}
        ratingLabel={<Trans>Overall rating</Trans>}
        questions={campaign.testerPerSessionQuestions}
        isOpenAtFirst={false}
      />
      <FeedbackFormPreview
        title={<Trans>Final survey</Trans>}
        description={<Trans>What a tester fills when they finish taking part.</Trans>}
        ratingLabel={<Trans>Overall rating</Trans>}
        questions={campaign.testerEndOfPhaseQuestions}
        isOpenAtFirst={false}
      />
      <FeedbackFormPreview
        title={<Trans>Session review</Trans>}
        description={<Trans>What a reviewer fills for each session.</Trans>}
        ratingLabel={<Trans>Your rating</Trans>}
        questions={campaign.reviewerQuestions}
        isOpenAtFirst={false}
      />
    </div>
  )
}

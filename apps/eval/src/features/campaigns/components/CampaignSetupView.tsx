import type { ReviewCampaignDetailOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { SectionCard } from "@/components/shared/SectionCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeedbackFormFields } from "./FeedbackFormFields"

export type CampaignSetupViewProps = {
  campaign: ReviewCampaignDetailOutputDto
  agentName: string
}

/**
 * The setup of a campaign that no longer changes: what it is, then its three forms as its testers
 * and reviewers fill them, one sub-tab per form.
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
      <Tabs defaultValue="session">
        <TabsList variant="line" className="max-w-full overflow-x-auto">
          <TabsTrigger value="session">
            <Trans>After each session</Trans>
          </TabsTrigger>
          <TabsTrigger value="final">
            <Trans>Final survey</Trans>
          </TabsTrigger>
          <TabsTrigger value="review">
            <Trans>Session review</Trans>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="session" className="flex flex-col gap-4 pt-4">
          <p className="text-muted-foreground">
            <Trans>What a tester fills when they end a session.</Trans>
          </p>
          <FeedbackFormFields
            ratingLabel={<Trans>Overall rating</Trans>}
            questions={campaign.testerPerSessionQuestions}
          />
        </TabsContent>
        <TabsContent value="final" className="flex flex-col gap-4 pt-4">
          <p className="text-muted-foreground">
            <Trans>What a tester fills when they finish taking part.</Trans>
          </p>
          <FeedbackFormFields
            ratingLabel={<Trans>Overall rating</Trans>}
            questions={campaign.testerEndOfPhaseQuestions}
          />
        </TabsContent>
        <TabsContent value="review" className="flex flex-col gap-4 pt-4">
          <p className="text-muted-foreground">
            <Trans>What a reviewer fills for each session.</Trans>
          </p>
          <FeedbackFormFields
            ratingLabel={<Trans>Your rating</Trans>}
            questions={campaign.reviewerQuestions}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@caseai-connect/app-ui/components/tabs"
import type {
  AgentParamsDto,
  AgentTypeDto,
  ReviewCampaignDetailOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { AgentVersionTitle } from "@/components/shared/AgentVersionTitle"
import { SectionCard } from "@/components/shared/SectionCard"
import { agentVersionsQueryOptions } from "@/features/agents"
import { AGENT_TYPE_LABELS } from "@/lib/agent-type-labels"
import { FeedbackFormFields } from "./FeedbackFormFields"

export type CampaignSetupViewProps = {
  campaign: ReviewCampaignDetailOutputDto
  agentName: string
  agentType: AgentTypeDto
  agentParams: AgentParamsDto
}

/**
 * The setup of a campaign that no longer changes: what it is, then its three forms as its testers
 * and reviewers fill them, one sub-tab per form.
 */
export function CampaignSetupView({
  campaign,
  agentName,
  agentType,
  agentParams,
}: CampaignSetupViewProps) {
  const { i18n } = useLingui()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  // An archived version is no longer listed: the campaign still runs on it.
  const version = versions.find((candidate) => candidate.id === campaign.agentSettingsId)
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
          <dt className="text-muted-foreground">
            <Trans comment="The kind of agent a review campaign reviews">Type</Trans>
          </dt>
          <dd>{i18n._(AGENT_TYPE_LABELS[agentType])}</dd>
          <dt className="text-muted-foreground">
            <Trans comment="The saved version of the agent's settings a review campaign runs on">
              Agent version
            </Trans>
          </dt>
          <dd>
            {version ? (
              <AgentVersionTitle version={version} />
            ) : (
              <span className="text-muted-foreground italic">
                <Trans>An archived version</Trans>
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
        <TabsContent value="session" className="flex flex-col gap-3 pt-4">
          <p className="pl-2.5 text-muted-foreground">
            <Trans>What a tester fills when they end a session.</Trans>
          </p>
          <FormFrame>
            <FeedbackFormFields
              ratingLabel={<Trans>Overall rating</Trans>}
              questions={campaign.testerPerSessionQuestions}
            />
          </FormFrame>
        </TabsContent>
        <TabsContent value="final" className="flex flex-col gap-3 pt-4">
          <p className="pl-2.5 text-muted-foreground">
            <Trans>What a tester fills when they finish taking part.</Trans>
          </p>
          <FormFrame>
            <FeedbackFormFields
              ratingLabel={<Trans>Overall rating</Trans>}
              questions={campaign.testerEndOfPhaseQuestions}
            />
          </FormFrame>
        </TabsContent>
        <TabsContent value="review" className="flex flex-col gap-3 pt-4">
          <p className="pl-2.5 text-muted-foreground">
            <Trans>What a reviewer fills for each session.</Trans>
          </p>
          <FormFrame>
            <FeedbackFormFields
              ratingLabel={<Trans>Your rating</Trans>}
              questions={campaign.reviewerQuestions}
            />
          </FormFrame>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** A frame around the form of a sub-tab, below its description. */
function FormFrame({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border bg-background p-4 md:p-6 dark:bg-card">{children}</div>
}

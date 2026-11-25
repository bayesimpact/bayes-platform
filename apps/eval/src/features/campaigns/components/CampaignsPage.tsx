import {
  type AgentParamsDto,
  PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
} from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { PlusIcon } from "lucide-react"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { buttonVariants } from "@/components/ui/button"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { projectCampaignsQueryOptions } from "../api/queries"
import { CampaignsEmptyState } from "./CampaignsEmptyState"
import { CampaignsTable } from "./CampaignsTable"

export type CampaignsPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
}

/** The review campaigns of an agent, with the way to a new one for who may create it. */
export function CampaignsPage({ agent, agentParams }: CampaignsPageProps) {
  const { data: projectCampaigns } = useSuspenseQuery(projectCampaignsQueryOptions(agentParams))
  const campaigns = projectCampaigns.filter((campaign) => campaign.agentId === agent.id)
  const canCreate = hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION)
  const newCampaignLink = canCreate ? (
    <Link
      to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/new"
      params={agentParams}
      className={cn(buttonVariants())}
    >
      <PlusIcon data-icon="inline-start" aria-hidden />
      <Trans>New campaign</Trans>
    </Link>
  ) : null
  return (
    <PageContainer>
      <PageHeader
        title={<Trans>Campaigns</Trans>}
        description={<Trans>Have testers try this agent, and reviewers read their sessions.</Trans>}
        actions={campaigns.length > 0 ? newCampaignLink : null}
      />
      {campaigns.length === 0 ? (
        <CampaignsEmptyState action={newCampaignLink} />
      ) : (
        <CampaignsTable agent={agentParams} campaigns={campaigns} />
      )}
    </PageContainer>
  )
}

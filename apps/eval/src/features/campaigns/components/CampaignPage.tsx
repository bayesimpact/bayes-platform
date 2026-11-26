import {
  type AgentParamsDto,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
  type ReviewCampaignParamsDto,
} from "@bayes-platform/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { campaignQueryOptions } from "../api/queries"
import type { CampaignTab, SetupStep } from "../schemas"
import { CampaignEditor } from "./CampaignEditor"
import { CampaignSetupWizard } from "./CampaignSetupWizard"

export type CampaignPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  campaignParams: ReviewCampaignParamsDto
  tab: CampaignTab | undefined
  step: SetupStep | undefined
  preview: boolean | undefined
}

/**
 * A campaign, for who manages it: a draft they can change is set up step by step, up to its
 * invitations once activated; any other campaign shows in tabs, its setup as its forms read.
 */
export function CampaignPage({ agent, step, tab, ...props }: CampaignPageProps) {
  const { data: campaign } = useSuspenseQuery(campaignQueryOptions(props.campaignParams))
  const canUpdate = hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION)
  const isSettingUp =
    (campaign.status === "draft" && canUpdate) ||
    (campaign.status === "active" && step === "invite")
  return isSettingUp ? (
    <CampaignSetupWizard agent={agent} step={step ?? "campaign"} {...props} />
  ) : (
    <CampaignEditor
      agent={agent}
      agentParams={props.agentParams}
      campaignParams={props.campaignParams}
      tab={tab}
    />
  )
}

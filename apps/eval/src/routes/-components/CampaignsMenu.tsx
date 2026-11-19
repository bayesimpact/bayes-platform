import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { MegaphoneIcon } from "lucide-react"
import { SidebarCollapsibleMenu } from "@/components/shared/SidebarCollapsibleMenu"
import type { EvaluationAgent } from "@/features/agents"
import { CampaignsSidebarEntries } from "@/features/campaigns"
import { ParticipantSidebarMenus } from "./ParticipantSidebarMenus"
import { useParticipantCampaigns } from "./use-participant-campaigns"

export type CampaignsMenuProps = {
  agentId: string
  /** The agent and its params for who manages its campaigns; none for who only takes part. */
  managed: { agent: EvaluationAgent; agentParams: AgentParamsDto } | null
}

/**
 * The Campaigns menu of the sidebar: the agent's campaigns for who manages them, then the
 * sub-menus of those the person reviews or tests. It shows when it holds something, and starts
 * open: every page of a campaign is in it.
 */
export function CampaignsMenu({ agentId, managed }: CampaignsMenuProps) {
  const { tested, reviewed } = useParticipantCampaigns(agentId)
  if (!managed && tested.length === 0 && reviewed.length === 0) return null
  return (
    <SidebarCollapsibleMenu
      Icon={MegaphoneIcon}
      label={
        <Trans comment="The sidebar's menu of the review campaigns an agent's managers run">
          Campaigns
        </Trans>
      }
    >
      {managed ? (
        <CampaignsSidebarEntries agent={managed.agent} agentParams={managed.agentParams} />
      ) : null}
      <ParticipantSidebarMenus agentId={agentId} />
    </SidebarCollapsibleMenu>
  )
}

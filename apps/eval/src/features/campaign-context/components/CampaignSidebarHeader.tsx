import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { AgentTypeIcon } from "@/components/shared/AgentTypeIcon"
import { useCampaignContext } from "../hooks/use-campaign-context"

export type CampaignSidebarHeaderProps = {
  campaign: ReviewCampaignParamsDto
}

/**
 * The top of the sidebar on a campaign's pages, for a person who only takes part in it: the agent
 * it tests, with the icon of its type, as an agent's pages show it.
 */
export function CampaignSidebarHeader({ campaign }: CampaignSidebarHeaderProps) {
  const context = useCampaignContext(campaign)
  return (
    <div className="flex h-8 items-center gap-2 p-2 text-sm">
      <span className="flex shrink-0 [&_svg]:size-4">
        <AgentTypeIcon type={context.agent.type} />
      </span>
      <span className="truncate font-medium">{context.agent.name}</span>
    </div>
  )
}

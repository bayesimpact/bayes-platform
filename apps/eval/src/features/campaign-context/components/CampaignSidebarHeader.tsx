import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useCampaignContext } from "../hooks/use-campaign-context"

export type CampaignSidebarHeaderProps = {
  campaign: ReviewCampaignParamsDto
  /** What the person does in the campaign on this page. */
  role: "tester" | "reviewer"
}

/** The top of the sidebar on a campaign's pages: the campaign, and what the person does in it. */
export function CampaignSidebarHeader({ campaign, role }: CampaignSidebarHeaderProps) {
  const context = useCampaignContext(campaign)
  const agentName = context.agent.name
  return (
    <div className="flex min-w-0 flex-col p-2 text-sm leading-tight">
      <span className="truncate text-xs text-muted-foreground">
        {role === "tester" ? (
          <Trans comment="Above a campaign's name in the sidebar: the person tests this agent">
            Test of {agentName}
          </Trans>
        ) : (
          <Trans comment="Above a campaign's name in the sidebar: the person reviews this agent">
            Review of {agentName}
          </Trans>
        )}
      </span>
      <span className="truncate font-medium">{context.name}</span>
    </div>
  )
}

import { TabsContent } from "@caseai-connect/app-ui/components/tabs"
import type { AgentParamsDto, ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { EvaluationAgent } from "@/features/agents"
import { campaignQueryOptions } from "../api/queries"
import type { CampaignTab } from "../schemas"
import { CampaignPageFrame } from "./CampaignPageFrame"
import { CampaignSetupView } from "./CampaignSetupView"
import { CampaignSummary } from "./CampaignSummary"
import { ParticipantsPanel } from "./ParticipantsPanel"

export type CampaignEditorProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  campaignParams: ReviewCampaignParamsDto
  /** The tab the URL names, or none for the campaign's first one. */
  tab: CampaignTab | undefined
}

/**
 * A campaign whose setup no longer changes, for who manages it, in tabs: its setup as its forms
 * read, its participants once active, its summary once closed, and what moves it on.
 */
export function CampaignEditor({ agent, agentParams, campaignParams, tab }: CampaignEditorProps) {
  const { data: campaign } = useSuspenseQuery(campaignQueryOptions(campaignParams))
  // A closed campaign opens on its figures, an active one on its people, a draft on its setup.
  const defaultTab: CampaignTab =
    campaign.status === "closed"
      ? "summary"
      : campaign.status === "active"
        ? "participants"
        : "setup"
  return (
    <CampaignPageFrame
      agent={agent}
      agentParams={agentParams}
      campaignParams={campaignParams}
      currentTab={tab ?? defaultTab}
      hasUnsavedChanges={false}
    >
      <TabsContent value="setup" className="pt-4">
        <CampaignSetupView
          campaign={campaign}
          agentName={agent.name}
          agentType={agent.type}
          agentParams={agentParams}
        />
      </TabsContent>
      <TabsContent value="participants" className="pt-4">
        <ParticipantsPanel agent={agent} campaign={campaign} campaignParams={campaignParams} />
      </TabsContent>
      <TabsContent value="summary" className="pt-4">
        <CampaignSummary aggregates={campaign.aggregates} />
      </TabsContent>
    </CampaignPageFrame>
  )
}

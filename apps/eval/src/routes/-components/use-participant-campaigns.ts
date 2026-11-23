import { useEvaluationWorkspace } from "@/features/agents"

/** The campaigns on an agent the person takes part in: those they test, and those they review. */
export function useParticipantCampaigns(agentId: string) {
  const { myCampaigns } = useEvaluationWorkspace()
  const agentCampaigns = myCampaigns.filter((campaign) => campaign.agentId === agentId)
  return {
    tested: agentCampaigns.filter((campaign) => campaign.roles.includes("tester")),
    reviewed: agentCampaigns.filter((campaign) => campaign.roles.includes("reviewer")),
  }
}

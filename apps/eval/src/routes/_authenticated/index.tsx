import { createFileRoute, redirect } from "@tanstack/react-router"
import { AppLogo } from "@/components/shared/AppLogo"
import { AppShell } from "@/components/shared/AppShell"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  agentPathParams,
  campaignPathParams,
  chooseDefaultAgent,
  flattenEvaluationAgents,
  loadEvaluationWorkspace,
  NoAgentState,
  readLastAgentId,
} from "@/features/agents"
import { AppSidebarFooter } from "@/routes/-components/AppSidebarFooter"
import { MyCampaignsNav } from "@/routes/-components/MyCampaignsNav"

/**
 * The app's home has no page of its own while the person has an agent: it opens the one they
 * used last, else the first one. With several, the command center opens over it, so they can go
 * elsewhere at once. With no agent, a person who tests or reviews opens on their first campaign,
 * and anyone else reads that there is nothing yet.
 */
export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context }) => {
    const { groups, myCampaigns } = await loadEvaluationWorkspace(context.queryClient)
    const agents = flattenEvaluationAgents(groups)
    const agent = chooseDefaultAgent(agents, readLastAgentId())
    if (agent) {
      throw redirect({
        to: "/o/$organizationId/p/$projectId/a/$agentId",
        params: agentPathParams(agent),
        search: agents.length > 1 ? { switchAgent: true } : {},
        replace: true,
      })
    }
    const campaign = myCampaigns[0]
    if (campaign) {
      throw redirect({
        to: campaign.roles.includes("tester")
          ? "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test"
          : "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review",
        params: campaignPathParams(campaign),
        replace: true,
      })
    }
  },
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
  component: NoAgentRoute,
})

function NoAgentRoute() {
  return (
    <AppShell header={<AppLogo />} sidebar={<MyCampaignsNav />} footer={<AppSidebarFooter />}>
      <NoAgentState />
    </AppShell>
  )
}

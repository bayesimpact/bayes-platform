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
  switchableAgentCountOf,
} from "@/features/agents"
import { AppSidebarFooter } from "@/routes/-components/AppSidebarFooter"

/**
 * The app's home has no page of its own while the person has an agent: it opens the one they
 * used last, else the first one. With several, the command center opens over it, so they can go
 * elsewhere at once. With no agent, a person who tests or reviews opens on their first campaign,
 * and anyone else reads that there is nothing yet.
 */
export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context }) => {
    const workspace = await loadEvaluationWorkspace(context.queryClient)
    const agent = chooseDefaultAgent(flattenEvaluationAgents(workspace.groups), readLastAgentId())
    // The command center counts the agents of the person's campaigns too: so does the home.
    const search = switchableAgentCountOf(workspace) > 1 ? { switchAgent: true } : {}
    if (agent) {
      throw redirect({
        to: "/o/$organizationId/p/$projectId/a/$agentId",
        params: agentPathParams(agent),
        search,
        replace: true,
      })
    }
    const campaign = workspace.myCampaigns[0]
    if (campaign) {
      throw redirect({
        to: campaign.roles.includes("tester")
          ? "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test"
          : "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review",
        params: campaignPathParams(campaign),
        search,
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
    <AppShell header={<AppLogo />} footer={<AppSidebarFooter />}>
      <NoAgentState />
    </AppShell>
  )
}

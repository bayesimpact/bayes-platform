import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadCampaignContext } from "@/features/campaign-context"
import { loadTesterSession, TesterSessionPage } from "@/features/campaign-test"
import { ConversationSkeleton, chat } from "@/features/conversation"
import { uuidParams } from "@/lib/not-found"

/** A tester's session with the campaign's agent. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/sessions/$sessionId",
)({
  params: { parse: uuidParams("sessionId") },
  beforeLoad: ({ context }) => {
    if (!context.campaignRoles.includes("tester")) throw notFound()
  },
  loader: async ({ context, params }) => {
    // The campaign names the agent the session talks to, which the messages' routes need.
    const campaign = await loadCampaignContext(context.queryClient, params)
    await loadTesterSession(context.queryClient, params, campaign.agent.id)
  },
  // Leaving the session stops reading its reply; the server finishes writing it.
  onLeave: ({ params }) => chat.stopReplyStream(params.sessionId),
  pendingComponent: ConversationSkeleton,
  errorComponent: RouteErrorState,
  component: TesterSessionRoute,
})

function TesterSessionRoute() {
  const params = Route.useParams()
  // Each session gets its own conversation: its draft and its panels start afresh.
  return <TesterSessionPage key={params.sessionId} sessionParams={params} />
}

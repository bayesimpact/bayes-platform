import { createFileRoute, notFound } from "@tanstack/react-router"
import { SessionComingSoon } from "@/features/sessions"

/** A past conversation with a conversation agent, which opens with the chat in a next change. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/as/$agentSessionId",
)({
  beforeLoad: ({ context }) => {
    if (context.agent.type !== "conversation") throw notFound()
  },
  component: () => <SessionComingSoon kind="conversation" />,
})

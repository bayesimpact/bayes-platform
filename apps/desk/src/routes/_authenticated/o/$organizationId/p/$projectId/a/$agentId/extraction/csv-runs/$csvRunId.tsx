import { createFileRoute, notFound } from "@tanstack/react-router"
import { SessionComingSoon } from "@/features/sessions"

/** A past extraction of a CSV file, which opens in a next change. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId",
)({
  beforeLoad: ({ context }) => {
    if (context.agent.type !== "extraction") throw notFound()
  },
  component: () => <SessionComingSoon kind="extraction" />,
})

import { Trans } from "@lingui/react/macro"
import { createFileRoute } from "@tanstack/react-router"

/** The page of an agent: a greeting for now. */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/a/$agentId/")({
  component: AgentRoute,
})

function AgentRoute() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">
        <Trans>Hello world!</Trans>
      </h1>
    </div>
  )
}

import { Trans } from "@lingui/react/macro"
import { createFileRoute } from "@tanstack/react-router"
import { FlaskConicalIcon } from "lucide-react"
import { StatusPage } from "@/components/shared/StatusPage"
import { requireEvaluationAgent } from "@/features/agents"

/** The evaluations of an agent, for who evaluates it: the place of its datasets and runs, empty for now. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/",
)({
  beforeLoad: ({ context }) => requireEvaluationAgent(context.agent),
  component: EvaluationsRoute,
})

function EvaluationsRoute() {
  return (
    <StatusPage
      icon={<FlaskConicalIcon aria-hidden />}
      title={<Trans>Evaluations are not here yet</Trans>}
      description={<Trans>The datasets and the runs of this agent will show on this page.</Trans>}
    />
  )
}

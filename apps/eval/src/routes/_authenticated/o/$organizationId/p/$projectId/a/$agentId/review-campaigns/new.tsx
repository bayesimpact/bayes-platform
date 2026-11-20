import { PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION } from "@caseai-connect/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { hasProjectPermission } from "@/features/agents"
import { defaultCampaignValues, NewCampaignPage, requireCampaignAgent } from "@/features/campaigns"

/** A new review campaign for an agent, for who may create one. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/new",
)({
  beforeLoad: ({ context }) => {
    requireCampaignAgent(context.agent)
    if (!hasProjectPermission(context.agent.project, PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION)) {
      throw notFound()
    }
  },
  errorComponent: RouteErrorState,
  component: NewCampaignRoute,
})

function NewCampaignRoute() {
  const { agent } = Route.useRouteContext()
  const { i18n } = useLingui()
  // Built once: the default questions get their ids here, and keep them while the person edits.
  const [defaultValues] = useState(() => defaultCampaignValues(i18n, agent.name))
  return (
    <NewCampaignPage agent={agent} agentParams={Route.useParams()} defaultValues={defaultValues} />
  )
}

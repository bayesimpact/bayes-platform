import { PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION } from "@caseai-connect/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { hasProjectPermission } from "@/features/agents"
import {
  agentVersionsQueryOptions,
  CampaignsPageSkeleton,
  defaultCampaignValues,
  loadNewCampaign,
  NewCampaignPage,
  requireCampaignAgent,
} from "@/features/campaigns"

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
  loader: ({ context, params }) => loadNewCampaign(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: NewCampaignRoute,
})

function NewCampaignRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { i18n } = useLingui()
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(params))
  // Built once: the default questions get their ids here, and keep them while the person edits.
  // The campaign runs on the version in production unless the person picks another.
  const [defaultValues] = useState(() =>
    defaultCampaignValues(i18n, agent.name, versions.find((version) => version.isProduction)?.id),
  )
  return <NewCampaignPage agent={agent} agentParams={params} defaultValues={defaultValues} />
}

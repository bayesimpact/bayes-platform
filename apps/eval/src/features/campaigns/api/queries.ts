import {
  type AgentParamsDto,
  EvalAgentsRoutes,
  EvalCampaignInvitationsRoutes,
  EvalReviewCampaignsRoutes,
  type ProjectParamsDto,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { campaignKeys } from "./keys"

/** The review campaigns of a project, newest first. */
export const projectCampaignsQueryOptions = (project: ProjectParamsDto) =>
  queryOptions({
    queryKey: campaignKeys.ofProject(project),
    queryFn: async ({ signal }) => {
      const { reviewCampaigns } = await apiRequest(EvalReviewCampaignsRoutes.getAllOfProject, {
        params: project,
        signal,
      })
      return reviewCampaigns.sort((first, second) => second.createdAt - first.createdAt)
    },
  })

/** A campaign with its people and, once closed, its first figures. */
export const campaignQueryOptions = (campaign: ReviewCampaignParamsDto) =>
  queryOptions({
    queryKey: campaignKeys.detail(campaign),
    queryFn: ({ signal }) =>
      apiRequest(EvalReviewCampaignsRoutes.getOne, { params: campaign, signal }),
  })

/** The invitations to a campaign that wait for an answer. */
export const campaignInvitationsQueryOptions = (campaign: ReviewCampaignParamsDto) =>
  queryOptions({
    queryKey: campaignKeys.invitations(campaign),
    queryFn: async ({ signal }) => {
      const { invitations } = await apiRequest(EvalCampaignInvitationsRoutes.getAll, {
        params: campaign,
        signal,
      })
      return invitations.filter((invitation) => invitation.status === "pending")
    },
  })

/**
 * The saved versions of an agent's settings a campaign can run on, newest first: the draft, which
 * changes under the testers, is not one of them.
 */
export const agentVersionsQueryOptions = (agent: AgentParamsDto) =>
  queryOptions({
    queryKey: campaignKeys.agentVersions(agent),
    queryFn: async ({ signal }) => {
      const versions = await apiRequest(EvalAgentsRoutes.getVersions, { params: agent, signal })
      return versions
        .filter((version) => !version.isDraft)
        .sort((first, second) => second.revision - first.revision)
    },
  })

import {
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

import {
  type CreateCampaignInvitationsInputDto,
  type CreateReviewCampaignInputDto,
  EvalCampaignInvitationsRoutes,
  EvalReviewCampaignsRoutes,
  type ProjectParamsDto,
  type ReviewCampaignParamsDto,
  type UpdateReviewCampaignInputDto,
} from "@caseai-connect/eval-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { campaignKeys } from "./keys"
import { campaignQueryOptions } from "./queries"

/** Creates a campaign, as a draft, then loads the project's list again. */
export function useCreateCampaign(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateReviewCampaignInputDto) =>
      apiRequest(EvalReviewCampaignsRoutes.createOne, { params: project, body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: campaignKeys.ofProject(project) }),
  })
}

/**
 * Saves a draft's configuration, or moves a campaign to its next status. The answer has the
 * campaign without its people: the editor shows it at once, then loads the whole again.
 */
export function useUpdateCampaign(campaign: ReviewCampaignParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateReviewCampaignInputDto) =>
      apiRequest(EvalReviewCampaignsRoutes.updateOne, { params: campaign, body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(campaignQueryOptions(campaign).queryKey, (detail) =>
        detail ? { ...detail, ...updated } : detail,
      )
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaign) }),
        queryClient.invalidateQueries({ queryKey: campaignKeys.ofProject(campaign) }),
      ]),
  })
}

/** Deletes a draft: its own queries go, so a step back does not show it again. */
export function useDeleteCampaign(campaign: ReviewCampaignParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest(EvalReviewCampaignsRoutes.deleteOne, { params: campaign }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: campaignKeys.detail(campaign) })
      queryClient.removeQueries({ queryKey: campaignKeys.invitations(campaign) })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: campaignKeys.ofProject(campaign) }),
  })
}

/** Invites people to a campaign, then loads its pending invitations again. */
export function useInviteParticipants(campaign: ReviewCampaignParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCampaignInvitationsInputDto) =>
      apiRequest(EvalCampaignInvitationsRoutes.createMany, { params: campaign, body }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: campaignKeys.invitations(campaign) }),
  })
}

/** Takes back an invitation nobody answered yet. */
export function useRevokeInvitation(campaign: ReviewCampaignParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest(EvalCampaignInvitationsRoutes.deleteOne, {
        params: { ...campaign, invitationId },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: campaignKeys.invitations(campaign) }),
  })
}

/** Takes one role of the campaign away from one person. */
export function useRevokeMembership(campaign: ReviewCampaignParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (membershipId: string) =>
      apiRequest(EvalReviewCampaignsRoutes.revokeMembership, {
        params: { ...campaign, membershipId },
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaign) }),
        queryClient.invalidateQueries({ queryKey: campaignKeys.ofProject(campaign) }),
      ]),
  })
}

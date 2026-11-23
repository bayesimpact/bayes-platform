import {
  EvalTesterRoutes,
  type RatedFeedbackInputDto,
  type ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { campaignTestKeys } from "./keys"
import { testerSurveyQueryOptions } from "./queries"

/** Starts a session with the campaign's agent, then loads the tester's sessions again. */
export function useStartSession(campaign: ReviewCampaignParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest(EvalTesterRoutes.startSession, { params: campaign, body: {} }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: campaignTestKeys.sessions(campaign) }),
  })
}

/** Deletes a session the tester gave no feedback on. */
export function useDeleteSession(campaign: ReviewCampaignParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest(EvalTesterRoutes.deleteSession, {
        params: {
          organizationId: campaign.organizationId,
          projectId: campaign.projectId,
          sessionId,
        },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: campaignTestKeys.sessions(campaign) }),
  })
}

/** Sends the tester's feedback on a session, which ends it. */
export function useSubmitFeedback(campaign: ReviewCampaignParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, feedback }: { sessionId: string; feedback: RatedFeedbackInputDto }) =>
      apiRequest(EvalTesterRoutes.createFeedback, {
        params: {
          organizationId: campaign.organizationId,
          projectId: campaign.projectId,
          sessionId,
        },
        body: feedback,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: campaignTestKeys.sessions(campaign) }),
  })
}

/** Sends the tester's final survey: a first one, or the change of the one they filled. */
export function useSaveSurvey(campaign: ReviewCampaignParamsDto, hasSurvey: boolean) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RatedFeedbackInputDto) =>
      apiRequest(hasSurvey ? EvalTesterRoutes.updateSurvey : EvalTesterRoutes.createSurvey, {
        params: campaign,
        body,
      }),
    onSuccess: (survey) => {
      queryClient.setQueryData(testerSurveyQueryOptions(campaign).queryKey, survey)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: campaignTestKeys.survey(campaign) }),
  })
}

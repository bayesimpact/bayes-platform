import { EvalTesterRoutes, type ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { campaignTestKeys } from "./keys"

/** The sessions the tester started in a campaign, newest first. */
export const testerSessionsQueryOptions = (campaign: ReviewCampaignParamsDto) =>
  queryOptions({
    queryKey: campaignTestKeys.sessions(campaign),
    queryFn: async ({ signal }) => {
      const { sessions } = await apiRequest(EvalTesterRoutes.getSessions, {
        params: campaign,
        signal,
      })
      return sessions
    },
  })

/** The tester's final survey of a campaign, or `null` before they filled it. */
export const testerSurveyQueryOptions = (campaign: ReviewCampaignParamsDto) =>
  queryOptions({
    queryKey: campaignTestKeys.survey(campaign),
    queryFn: async ({ signal }) => {
      const { survey } = await apiRequest(EvalTesterRoutes.getSurvey, { params: campaign, signal })
      return survey
    },
  })

import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { ITesterSpi } from "../tester.spi"

const testerApi = {
  listMyCampaigns: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ReviewCampaignsRoutes.getMyReviewCampaigns.response>(
      ReviewCampaignsRoutes.getMyReviewCampaigns.getPath(),
    )
    return response.data.data.reviewCampaigns
  },

  getTesterContext: async ({ organizationId, projectId, reviewCampaignId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ReviewCampaignsRoutes.getTesterContext.response>(
      ReviewCampaignsRoutes.getTesterContext.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
    )
    return response.data.data
  },

  listMyTesterSessions: async ({ organizationId, projectId, reviewCampaignId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ReviewCampaignsRoutes.listMyTesterSessions.response>(
      ReviewCampaignsRoutes.listMyTesterSessions.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
    )
    return response.data.data.sessions
  },

  startSession: async ({ organizationId, projectId, reviewCampaignId }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ReviewCampaignsRoutes.startTesterSession.response>(
      ReviewCampaignsRoutes.startTesterSession.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
      { payload: {} } satisfies typeof ReviewCampaignsRoutes.startTesterSession.request,
    )
    return response.data.data
  },

  submitFeedback: async ({ organizationId, projectId, sessionId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ReviewCampaignsRoutes.submitTesterFeedback.response>(
      ReviewCampaignsRoutes.submitTesterFeedback.getPath({
        organizationId,
        projectId,
        sessionId,
      }),
      { payload },
    )
    return response.data.data
  },

  updateFeedback: async ({ organizationId, projectId, sessionId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.patch<typeof ReviewCampaignsRoutes.updateTesterFeedback.response>(
      ReviewCampaignsRoutes.updateTesterFeedback.getPath({
        organizationId,
        projectId,
        sessionId,
      }),
      { payload },
    )
    return response.data.data
  },

  submitSurvey: async ({ organizationId, projectId, reviewCampaignId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ReviewCampaignsRoutes.submitTesterSurvey.response>(
      ReviewCampaignsRoutes.submitTesterSurvey.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
      { payload },
    )
    return response.data.data
  },

  updateSurvey: async ({ organizationId, projectId, reviewCampaignId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.patch<typeof ReviewCampaignsRoutes.updateTesterSurvey.response>(
      ReviewCampaignsRoutes.updateTesterSurvey.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
      { payload },
    )
    return response.data.data
  },

  getMyTesterSurvey: async ({ organizationId, projectId, reviewCampaignId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ReviewCampaignsRoutes.getMyTesterSurvey.response>(
      ReviewCampaignsRoutes.getMyTesterSurvey.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
    )
    return response.data.data.survey
  },

  deleteSession: async ({ organizationId, projectId, sessionId }) => {
    const axios = getAxiosInstance()
    await axios.delete<typeof ReviewCampaignsRoutes.deleteTesterSession.response>(
      ReviewCampaignsRoutes.deleteTesterSession.getPath({
        organizationId,
        projectId,
        sessionId,
      }),
    )
  },
} satisfies ITesterSpi

export default testerApi

import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { IReviewCampaignsSpi } from "../review-campaigns.spi"

const reviewCampaignsApi = {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ReviewCampaignsRoutes.getAll.response>(
      ReviewCampaignsRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.reviewCampaigns
  },

  getOne: async ({ organizationId, projectId, reviewCampaignId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ReviewCampaignsRoutes.getOne.response>(
      ReviewCampaignsRoutes.getOne.getPath({ organizationId, projectId, reviewCampaignId }),
    )
    return response.data.data
  },

  createOne: async ({ organizationId, projectId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ReviewCampaignsRoutes.createOne.response>(
      ReviewCampaignsRoutes.createOne.getPath({ organizationId, projectId }),
      { payload },
    )
    return response.data.data
  },

  updateOne: async ({ organizationId, projectId, reviewCampaignId }, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.patch<typeof ReviewCampaignsRoutes.updateOne.response>(
      ReviewCampaignsRoutes.updateOne.getPath({ organizationId, projectId, reviewCampaignId }),
      { payload },
    )
    return response.data.data
  },

  deleteOne: async ({ organizationId, projectId, reviewCampaignId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ReviewCampaignsRoutes.deleteOne.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
    )
  },

  revokeMembership: async ({ organizationId, projectId, reviewCampaignId, membershipId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ReviewCampaignsRoutes.revokeMembership.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
        membershipId,
      }),
    )
  },
} satisfies IReviewCampaignsSpi

export default reviewCampaignsApi

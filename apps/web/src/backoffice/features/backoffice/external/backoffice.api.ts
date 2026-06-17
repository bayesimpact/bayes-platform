import { BackofficeRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import {
  toBackofficeUserDetail,
  toPaginatedBackofficeOrganizations,
  toPaginatedBackofficeUsers,
} from "../backoffice.models"
import type { IBackofficeSpi } from "../backoffice.spi"

export default {
  listOrganizations: async ({ page, limit, search }) => {
    const axios = getAxiosInstance()
    const queryParams: Record<string, string> = {}
    if (page !== undefined) queryParams.page = String(page)
    if (limit !== undefined) queryParams.limit = String(limit)
    if (search) queryParams.search = search

    const response = await axios.get<typeof BackofficeRoutes.listOrganizations.response>(
      BackofficeRoutes.listOrganizations.getPath(),
      { params: queryParams },
    )
    return toPaginatedBackofficeOrganizations(response.data.data)
  },
  listUsers: async ({ page, limit, search }) => {
    const axios = getAxiosInstance()
    const queryParams: Record<string, string> = {}
    if (page !== undefined) queryParams.page = String(page)
    if (limit !== undefined) queryParams.limit = String(limit)
    if (search) queryParams.search = search

    const response = await axios.get<typeof BackofficeRoutes.listUsers.response>(
      BackofficeRoutes.listUsers.getPath(),
      { params: queryParams },
    )
    return toPaginatedBackofficeUsers(response.data.data)
  },
  getUser: async (userId) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof BackofficeRoutes.getUser.response>(
      BackofficeRoutes.getUser.getPath({ userId }),
    )
    return toBackofficeUserDetail(response.data.data)
  },
  addFeatureFlag: async ({ projectId, featureFlagKey }) => {
    const axios = getAxiosInstance()
    await axios.post(BackofficeRoutes.addFeatureFlag.getPath({ projectId }), {
      payload: { featureFlagKey },
    } satisfies typeof BackofficeRoutes.addFeatureFlag.request)
  },
  removeFeatureFlag: async ({ projectId, featureFlagKey }) => {
    const axios = getAxiosInstance()
    await axios.delete(BackofficeRoutes.removeFeatureFlag.getPath({ projectId, featureFlagKey }))
  },
  listTermsDocuments: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof BackofficeRoutes.listTermsDocuments.response>(
      BackofficeRoutes.listTermsDocuments.getPath(),
    )
    return response.data.data.documents
  },
  updateTermsDocuments: async (input) => {
    const axios = getAxiosInstance()
    const response = await axios.put<typeof BackofficeRoutes.updateTermsDocuments.response>(
      BackofficeRoutes.updateTermsDocuments.getPath(),
      {
        payload: input,
      } satisfies typeof BackofficeRoutes.updateTermsDocuments.request,
    )
    return response.data.data.documents
  },
} satisfies IBackofficeSpi

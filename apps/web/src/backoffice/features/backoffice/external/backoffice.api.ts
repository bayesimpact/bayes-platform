import { AppsRoutes, BackofficeRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import {
  toAppManifest,
  toBackofficeAgentDetail,
  toBackofficeOrganization,
  toBackofficeOrganizationDetail,
  toBackofficeProjectDetail,
  toBackofficeRbacCatalog,
  toBackofficeUserDetail,
  toPaginatedBackofficeAgents,
  toPaginatedBackofficeOrganizations,
  toPaginatedBackofficeProjects,
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
  getOrganization: async (organizationId) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof BackofficeRoutes.getOrganization.response>(
      BackofficeRoutes.getOrganization.getPath({ organizationId }),
    )
    return toBackofficeOrganizationDetail(response.data.data)
  },
  createOrganization: async ({ name }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof BackofficeRoutes.createOrganization.response>(
      BackofficeRoutes.createOrganization.getPath(),
      { payload: { name } } satisfies typeof BackofficeRoutes.createOrganization.request,
    )
    return toBackofficeOrganization(response.data.data)
  },
  listAgents: async ({ page, limit, search }) => {
    const axios = getAxiosInstance()
    const queryParams: Record<string, string> = {}
    if (page !== undefined) queryParams.page = String(page)
    if (limit !== undefined) queryParams.limit = String(limit)
    if (search) queryParams.search = search

    const response = await axios.get<typeof BackofficeRoutes.listAgents.response>(
      BackofficeRoutes.listAgents.getPath(),
      { params: queryParams },
    )
    return toPaginatedBackofficeAgents(response.data.data)
  },
  getAgent: async (agentId) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof BackofficeRoutes.getAgent.response>(
      BackofficeRoutes.getAgent.getPath({ agentId }),
    )
    return toBackofficeAgentDetail(response.data.data)
  },
  listProjects: async ({ page, limit, search }) => {
    const axios = getAxiosInstance()
    const queryParams: Record<string, string> = {}
    if (page !== undefined) queryParams.page = String(page)
    if (limit !== undefined) queryParams.limit = String(limit)
    if (search) queryParams.search = search

    const response = await axios.get<typeof BackofficeRoutes.listProjects.response>(
      BackofficeRoutes.listProjects.getPath(),
      { params: queryParams },
    )
    return toPaginatedBackofficeProjects(response.data.data)
  },
  getProject: async (projectId) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof BackofficeRoutes.getProject.response>(
      BackofficeRoutes.getProject.getPath({ projectId }),
    )
    return toBackofficeProjectDetail(response.data.data)
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
  getRbacCatalog: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof BackofficeRoutes.getRbacCatalog.response>(
      BackofficeRoutes.getRbacCatalog.getPath(),
    )
    return toBackofficeRbacCatalog(response.data.data)
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
  listAppManifests: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AppsRoutes.getAll.response>(AppsRoutes.getAll.getPath())
    return response.data.data.map(toAppManifest)
  },
  createAppManifest: async (input) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AppsRoutes.createOne.response>(
      AppsRoutes.createOne.getPath(),
      { payload: input } satisfies typeof AppsRoutes.createOne.request,
    )
    return toAppManifest(response.data.data)
  },
  updateAppManifest: async ({ appManifestId, input }) => {
    const axios = getAxiosInstance()
    const response = await axios.patch<typeof AppsRoutes.updateOne.response>(
      AppsRoutes.updateOne.getPath({ appManifestId }),
      { payload: input } satisfies typeof AppsRoutes.updateOne.request,
    )
    return toAppManifest(response.data.data)
  },
  deleteAppManifest: async (appManifestId) => {
    const axios = getAxiosInstance()
    await axios.delete(AppsRoutes.deleteOne.getPath({ appManifestId }))
  },
} satisfies IBackofficeSpi

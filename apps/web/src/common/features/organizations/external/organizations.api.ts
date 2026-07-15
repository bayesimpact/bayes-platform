import {
  type OrganizationDto,
  OrganizationsRoutes,
  type UserOrganizationListItemDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { OrganizationListItem } from "../organizations.models"
import type { IOrganizationsSpi } from "../organizations.spi"

export default {
  list: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof OrganizationsRoutes.listOrganizations.response>(
      OrganizationsRoutes.listOrganizations.getPath(),
    )
    return response.data.data.map(toOrganizationListItem)
  },
  createOne: async (payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof OrganizationsRoutes.createOrganization.response>(
      OrganizationsRoutes.createOrganization.getPath(),
      { payload } satisfies typeof OrganizationsRoutes.createOrganization.request,
    )
    return { id: response.data.data.id }
  },
  updateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    await axios.patch(OrganizationsRoutes.updateOrganization.getPath(params), {
      payload,
    } satisfies typeof OrganizationsRoutes.updateOrganization.request)
  },
} satisfies IOrganizationsSpi

export const toOrganizationListItem = (dto: UserOrganizationListItemDto): OrganizationListItem => ({
  id: dto.id,
  name: dto.name,
  permissions: dto.permissions,
  projects: dto.projects.map((project) => ({
    id: project.id,
    name: project.name,
    featureFlags: project.featureFlags,
  })),
})

/** Maps legacy create response when full organization payload is needed. */
export const toCreatedOrganization = (dto: OrganizationDto): { id: string; name: string } => ({
  id: dto.id,
  name: dto.name,
})

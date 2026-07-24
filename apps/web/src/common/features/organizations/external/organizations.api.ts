import { type OrganizationDto, OrganizationsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { Organization } from "../organizations.models"
import type { IOrganizationsSpi } from "../organizations.spi"

export default {
  list: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof OrganizationsRoutes.getAllMine.response>(
      OrganizationsRoutes.getAllMine.getPath(),
    )
    return response.data.data.map(toOrganization)
  },
  createOne: async (payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof OrganizationsRoutes.createOne.response>(
      OrganizationsRoutes.createOne.getPath(),
      { payload } satisfies typeof OrganizationsRoutes.createOne.request,
    )
    return { id: response.data.data.id }
  },
  updateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    await axios.patch(OrganizationsRoutes.updateOne.getPath(params), {
      payload,
    } satisfies typeof OrganizationsRoutes.updateOne.request)
  },
} satisfies IOrganizationsSpi

export const toOrganization = (dto: OrganizationDto): Organization => ({
  id: dto.id,
  name: dto.name,
  permissions: dto.permissions,
})

/** Maps legacy create response when full organization payload is needed. */
export const toCreatedOrganization = (dto: OrganizationDto): { id: string; name: string } => ({
  id: dto.id,
  name: dto.name,
})

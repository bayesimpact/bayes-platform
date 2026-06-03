import { type OrganizationDto, OrganizationsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import { toProject } from "../../projects/external/projects.api"
import type { Organization } from "../organizations.models"
import type { IOrganizationsSpi } from "../organizations.spi"

export default {
  createOne: async (payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof OrganizationsRoutes.createOrganization.response>(
      OrganizationsRoutes.createOrganization.getPath(),
      { payload } satisfies typeof OrganizationsRoutes.createOrganization.request,
    )
    return toOrganization(response.data.data)
  },
  updateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    await axios.patch(OrganizationsRoutes.updateOrganization.getPath(params), {
      payload,
    } satisfies typeof OrganizationsRoutes.updateOrganization.request)
  },
} satisfies IOrganizationsSpi

export const toOrganization = (dto: OrganizationDto): Organization => ({
  id: dto.id,
  name: dto.name,
  createdAt: dto.createdAt,
  projects: dto.projects.map(toProject),
})

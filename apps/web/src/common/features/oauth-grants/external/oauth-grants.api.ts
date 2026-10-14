import { type OAuthGrantDto, OAuthRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { OAuthGrant } from "../oauth-grants.models"
import type { IOAuthGrantsSpi } from "../oauth-grants.spi"

export default {
  getAll: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof OAuthRoutes.getAllGrants.response>(
      OAuthRoutes.getAllGrants.getPath(),
    )
    return response.data.data.map(toOAuthGrant)
  },
  deleteOne: async (grantId) => {
    const axios = getAxiosInstance()
    await axios.delete<typeof OAuthRoutes.deleteOneGrant.response>(
      OAuthRoutes.deleteOneGrant.getPath({ grantId }),
    )
  },
} satisfies IOAuthGrantsSpi

const toOAuthGrant = (dto: OAuthGrantDto): OAuthGrant => ({
  id: dto.id,
  client: {
    clientId: dto.client.clientId,
    name: dto.client.name,
    verified: dto.client.verified,
  },
  projects: dto.projects.map((project) => ({ id: project.id, name: project.name })),
  permissions: dto.permissions,
  createdAt: dto.createdAt,
  lastUsedAt: dto.lastUsedAt,
})

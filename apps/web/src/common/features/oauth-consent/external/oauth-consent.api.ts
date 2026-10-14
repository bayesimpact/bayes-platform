import {
  type OAuthConsentPageDto,
  type OAuthConsentResponseDto,
  OAuthRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { ApproveOAuthConsentResult, OAuthConsentPage } from "../oauth-consent.models"
import type { IOAuthConsentSpi } from "../oauth-consent.spi"

export default {
  getConsentPage: async (request) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof OAuthRoutes.getConsent.response>(
      OAuthRoutes.getConsent.getPath(),
      { params: request },
    )
    return toOAuthConsentPage(response.data.data)
  },
  approve: async (input) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof OAuthRoutes.approveConsent.response>(
      OAuthRoutes.approveConsent.getPath(),
      { payload: input } satisfies typeof OAuthRoutes.approveConsent.request,
    )
    return toApproveResult(response.data.data)
  },
} satisfies IOAuthConsentSpi

const toOAuthConsentPage = (dto: OAuthConsentPageDto): OAuthConsentPage => ({
  client: {
    clientId: dto.client.clientId,
    name: dto.client.name,
    redirectHost: dto.client.redirectHost,
    verified: dto.client.verified,
  },
  projects: dto.projects.map((project) => ({
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    organizationName: project.organizationName,
    availablePermissions: project.availablePermissions,
  })),
  grantablePermissions: dto.grantablePermissions,
})

const toApproveResult = (dto: OAuthConsentResponseDto): ApproveOAuthConsentResult => ({
  redirectTo: dto.redirectTo,
})

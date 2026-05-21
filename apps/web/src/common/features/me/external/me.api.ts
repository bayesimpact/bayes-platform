import { type MeResponseDto, MeRoutes } from "@caseai-connect/api-contracts"
import { toOrganization } from "@/common/features/organizations/external/organizations.api"
import { getAxiosInstance } from "@/external/axios"
import type { Me } from "../me.models"
import type { IMeSpi } from "../me.spi"

export default {
  getMe: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof MeRoutes.getMe.response>(MeRoutes.getMe.getPath())
    return toMe(response.data.data)
  },
  acceptTerms: async ({ aiUsagePolicyAccepted }) => {
    const axios = getAxiosInstance()
    await axios.post(MeRoutes.acceptTerms.getPath(), {
      payload: { aiUsagePolicyAccepted },
    } satisfies typeof MeRoutes.acceptTerms.request)
  },
} satisfies IMeSpi

const toMe = (dto: MeResponseDto): Me => ({
  user: {
    id: dto.user.id,
    email: dto.user.email,
    name: dto.user.name,
    memberships: dto.user.memberships,
    isBackofficeAuthorized: dto.user.isBackofficeAuthorized,
    isTermsManagementAuthorized: dto.user.isTermsManagementAuthorized,
    termsAccepted: dto.user.termsAccepted,
  },
  organizations: dto.organizations.map(toOrganization),
  currentTerms: dto.currentTerms,
})

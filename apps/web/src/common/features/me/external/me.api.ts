import { type MeResponseDto, MeRoutes, type UserDto } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { Me, User } from "../me.models"
import type { IMeSpi } from "../me.spi"

export default {
  getMe: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof MeRoutes.getMe.response>(MeRoutes.getMe.getPath())
    return toMe(response.data.data)
  },
  updateMe: async ({ name }) => {
    const axios = getAxiosInstance()
    await axios.patch<typeof MeRoutes.patchMe.response>(MeRoutes.patchMe.getPath(), {
      payload: { name },
    } satisfies typeof MeRoutes.patchMe.request)
  },
  acceptTerms: async ({ aiUsagePolicyAccepted }) => {
    const axios = getAxiosInstance()
    await axios.post(MeRoutes.acceptTerms.getPath(), {
      payload: { aiUsagePolicyAccepted },
    } satisfies typeof MeRoutes.acceptTerms.request)
  },
} satisfies IMeSpi

const toUser = (dto: UserDto): User => ({
  id: dto.id,
  email: dto.email,
  name: dto.name,
  globalPermissions: dto.globalPermissions,
  memberships: dto.memberships,
  isBackofficeAuthorized: dto.isBackofficeAuthorized,
  isTermsManagementAuthorized: dto.isTermsManagementAuthorized,
  termsAccepted: dto.termsAccepted,
})

const toMe = (dto: MeResponseDto): Me => ({
  user: toUser(dto.user),
  currentTerms: dto.currentTerms,
})

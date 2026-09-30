import { MemberGrantsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { IMemberGrantsSpi } from "../member-grants.spi"

export default {
  createMany: async ({ targetType, targetId, emails, role }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof MemberGrantsRoutes.createMany.response>(
      MemberGrantsRoutes.createMany.getPath(),
      { payload: { targetType, targetId, emails, role } },
    )
    return { grantedEmails: response.data.data.grantedEmails }
  },
} satisfies IMemberGrantsSpi

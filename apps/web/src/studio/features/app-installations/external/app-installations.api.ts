import {
  type AppInstallationSummaryDto,
  ProjectAppInstallationsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AppInstallation } from "../app-installations.models"
import type { IAppInstallationsSpi } from "../app-installations.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectAppInstallationsRoutes.getAll.response>(
      ProjectAppInstallationsRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(toAppInstallation)
  },
} satisfies IAppInstallationsSpi

const toAppInstallation = (dto: AppInstallationSummaryDto): AppInstallation => ({
  id: dto.id,
  appName: dto.appName,
  description: dto.description,
  logoUrl: dto.logoUrl,
  permissions: dto.permissions,
  createdAt: dto.createdAt,
})

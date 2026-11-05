import { type AppCatalogEntryDto, ProjectAppCatalogRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AppCatalogEntry } from "../app-catalog.models"
import type { IAppCatalogSpi } from "../app-catalog.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectAppCatalogRoutes.getAll.response>(
      ProjectAppCatalogRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(toAppCatalogEntry)
  },
} satisfies IAppCatalogSpi

const toAppCatalogEntry = (dto: AppCatalogEntryDto): AppCatalogEntry => ({
  id: dto.id,
  name: dto.name,
  description: dto.description,
  logoUrl: dto.logoUrl,
  appUrl: dto.appUrl,
  installInstructions: dto.installInstructions,
  grantablePermissions: dto.grantablePermissions,
  installed: dto.installed,
})

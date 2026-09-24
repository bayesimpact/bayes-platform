import {
  type AppInstallationSummaryDto,
  type AppInstallPageDto,
  AppsRoutes,
  type AuthorizeAppInstallResponseDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type {
  AppInstallPage,
  AuthorizeAppInstallResult,
  ProjectAppInstallation,
} from "../app-install.models"
import type { IAppInstallSpi } from "../app-install.spi"

export default {
  getInstallPage: async (slug) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AppsRoutes.getInstall.response>(
      AppsRoutes.getInstall.getPath({ slug }),
    )
    return toAppInstallPage(response.data.data)
  },
  authorize: async ({ slug, projectId, permissions, redirectUri, state }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AppsRoutes.authorize.response>(
      AppsRoutes.authorize.getPath({ slug }),
      {
        payload: { projectId, permissions, redirectUri, state },
      } satisfies typeof AppsRoutes.authorize.request,
    )
    return toAuthorizeResult(response.data.data)
  },
  listForProject: async (projectId) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AppsRoutes.listForProject.response>(
      AppsRoutes.listForProject.getPath({ projectId }),
    )
    return response.data.data.map(toProjectAppInstallation)
  },
  revoke: async (installationId) => {
    const axios = getAxiosInstance()
    await axios.post(AppsRoutes.revoke.getPath({ id: installationId }))
  },
} satisfies IAppInstallSpi

const toAppInstallPage = (dto: AppInstallPageDto): AppInstallPage => ({
  app: {
    id: dto.app.id,
    name: dto.app.name,
    slug: dto.app.slug,
    description: dto.app.description,
    logoUrl: dto.app.logoUrl,
    grantablePermissions: dto.app.grantablePermissions,
  },
  projects: dto.projects.map((project) => ({
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    organizationName: project.organizationName,
  })),
})

const toProjectAppInstallation = (dto: AppInstallationSummaryDto): ProjectAppInstallation => ({
  id: dto.id,
  appName: dto.appName,
  description: dto.description,
  logoUrl: dto.logoUrl,
  permissions: dto.permissions,
  createdAt: dto.createdAt,
})

const toAuthorizeResult = (dto: AuthorizeAppInstallResponseDto): AuthorizeAppInstallResult => ({
  clientId: dto.clientId,
  clientSecret: dto.clientSecret,
  redirectUri: dto.redirectUri,
  state: dto.state,
})

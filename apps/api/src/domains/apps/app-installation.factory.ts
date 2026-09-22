import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import { APP_INSTALLATION_STATUS_ACTIVE, type AppInstallation } from "./app-installation.entity"

export const appInstallationFactory = Factory.define<AppInstallation>(({ params }) => {
  const now = new Date()
  return {
    id: params.id || randomUUID(),
    appManifestId: params.appManifestId || randomUUID(),
    projectId: params.projectId || randomUUID(),
    serviceUserId: params.serviceUserId ?? null,
    customRoleId: params.customRoleId ?? null,
    clientId: params.clientId ?? null,
    clientSecretHash: params.clientSecretHash ?? null,
    status: params.status ?? APP_INSTALLATION_STATUS_ACTIVE,
    createdByUserId: params.createdByUserId ?? null,
    revokedAt: params.revokedAt ?? null,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: params.deletedAt ?? null,
  } as AppInstallation
})

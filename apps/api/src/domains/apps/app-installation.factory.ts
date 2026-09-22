import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import { APP_INSTALLATION_STATUS_ACTIVE, type AppInstallation } from "./app-installation.entity"

export const appInstallationFactory = Factory.define<AppInstallation>(({ params }) => {
  const now = new Date()
  return {
    id: params.id || randomUUID(),
    appManifestId: params.appManifestId || randomUUID(),
    projectId: params.projectId || randomUUID(),
    status: params.status ?? APP_INSTALLATION_STATUS_ACTIVE,
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: params.deletedAt ?? null,
  } as AppInstallation
})

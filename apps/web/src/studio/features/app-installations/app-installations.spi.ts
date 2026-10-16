import type { AppInstallation } from "./app-installations.models"

type ProjectScope = { organizationId: string; projectId: string }
type AppInstallationScope = ProjectScope & { appInstallationId: string }

export interface IAppInstallationsSpi {
  getAll: (params: ProjectScope) => Promise<AppInstallation[]>
  revokeOne: (params: AppInstallationScope) => Promise<void>
}

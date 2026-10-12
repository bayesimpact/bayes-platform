import type { AppInstallation } from "./app-installations.models"

type ProjectScope = { organizationId: string; projectId: string }

export interface IAppInstallationsSpi {
  getAll: (params: ProjectScope) => Promise<AppInstallation[]>
}

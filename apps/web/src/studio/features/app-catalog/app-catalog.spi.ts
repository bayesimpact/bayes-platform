import type { AppCatalogEntry } from "./app-catalog.models"

type ProjectScope = { organizationId: string; projectId: string }

export interface IAppCatalogSpi {
  getAll: (params: ProjectScope) => Promise<AppCatalogEntry[]>
}

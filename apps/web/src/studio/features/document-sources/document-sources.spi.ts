import type { DocumentSource } from "./document-sources.models"

type ProjectScope = { organizationId: string; projectId: string }

export interface IDocumentSourcesSpi {
  getAll: (params: ProjectScope) => Promise<DocumentSource[]>
  deleteOne: (params: ProjectScope & { documentSourceId: string }) => Promise<void>
}

import type { DocumentTagsUpdateFields } from "@/studio/features/document-tags/document-tags.models"
import type { DocumentSource } from "./document-sources.models"

type ProjectScope = { organizationId: string; projectId: string }

export interface IDocumentSourcesSpi {
  getAll: (params: ProjectScope) => Promise<DocumentSource[]>
  updateOne: (
    params: ProjectScope & { documentSourceId: string; payload: DocumentTagsUpdateFields },
  ) => Promise<void>
  deleteOne: (params: ProjectScope & { documentSourceId: string }) => Promise<void>
}

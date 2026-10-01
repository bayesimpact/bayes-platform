import type { DocumentSourceStatus, TimeType } from "@caseai-connect/api-contracts"

export type DocumentSourceApp = {
  name: string
  logoUrl: string | null
}

export type DocumentSource = {
  id: string
  projectId: string
  name: string
  type: string | null
  externalId: string | null
  baseUrl: string | null
  app: DocumentSourceApp | null
  documentCount: number
  indexedDocumentCount: number
  lastSyncedAt: TimeType | null
  status: DocumentSourceStatus
  createdAt: TimeType
  updatedAt: TimeType
}

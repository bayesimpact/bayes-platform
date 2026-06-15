export type RetrievedDocumentChunk = {
  chunkId: string
  documentId: string
  documentTitle: string
  documentFileName: string | null
  documentSourceType: string
  chunkIndex: number
  content: string
  distance: number
  modelName: string
  isParentChunk: boolean
  isPublicDocument: boolean
}

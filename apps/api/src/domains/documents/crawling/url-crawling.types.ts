export type CrawlUrlJobPayload = {
  documentId: string
  url: string
  limit: number
  organizationId: string
  projectId: string
  requestedByUserId: string
  currentTraceId: string
}

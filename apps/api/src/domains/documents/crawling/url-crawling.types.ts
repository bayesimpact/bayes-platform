export type CrawlUrlJobPayload = {
  documentId: string
  url: string
  organizationId: string
  projectId: string
  requestedByUserId: string
  currentTraceId: string
}

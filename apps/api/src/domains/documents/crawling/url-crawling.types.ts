export type CrawlUrlJobPayload = {
  url: string
  limit: number
  organizationId: string
  projectId: string
  requestedByUserId: string
  currentTraceId: string
}

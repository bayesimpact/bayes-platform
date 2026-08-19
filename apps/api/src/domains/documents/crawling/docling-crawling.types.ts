export type CrawlUrlDoclingJobPayload = {
  documentId: string
  url: string
  organizationId: string
  projectId: string
  requestedByUserId: string
  currentTraceId: string
  generation: number
}

export type CrawlUrlDoclingEnqueueRequest = Omit<CrawlUrlDoclingJobPayload, "generation">

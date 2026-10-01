import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { DocumentSource, DocumentSourceApp } from "./document-sources.models"

type DocumentSourceTransientParams = {
  project: Project
}

class DocumentSourceFactory extends Factory<DocumentSource, DocumentSourceTransientParams> {}

export const documentSourceFactory = DocumentSourceFactory.define(({ params, transientParams }) => {
  const { project } = transientParams
  if (!project) {
    throw new Error("Project must be provided in transient params to build a DocumentSource")
  }

  const documentCount = params.documentCount ?? faker.number.int({ min: 1, max: 12 })
  return {
    id: params.id ?? faker.string.uuid(),
    projectId: project.id,
    name: params.name ?? faker.commerce.productName(),
    type: params.type === undefined ? "site-crawler" : params.type,
    externalId: params.externalId === undefined ? faker.internet.domainName() : params.externalId,
    baseUrl: params.baseUrl === undefined ? faker.internet.url() : params.baseUrl,
    app: toDocumentSourceApp(params.app),
    documentCount,
    indexedDocumentCount: params.indexedDocumentCount ?? documentCount,
    lastSyncedAt:
      params.lastSyncedAt !== undefined ? params.lastSyncedAt : faker.date.recent().getTime(),
    status: params.status ?? "ready",
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
  }
})

function toDocumentSourceApp(
  app: { name?: string; logoUrl?: string | null } | null | undefined,
): DocumentSourceApp | null {
  if (!app?.name) return null
  return { name: app.name, logoUrl: app.logoUrl ?? null }
}

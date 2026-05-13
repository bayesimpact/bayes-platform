import { randomUUID } from "node:crypto"
import { MimeTypes } from "@caseai-connect/api-contracts"
import { Factory } from "fishery"
import type { Repository } from "typeorm"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { Document } from "./document.entity"

type DocumentTransientParams = RequiredScopeTransientParams

class DocumentFactory extends Factory<Document, DocumentTransientParams> {}

export const documentFactory = DocumentFactory.define(({ sequence, params, transientParams }) => {
  if (!transientParams.organization) {
    throw new Error("organization transient is required")
  }
  if (!transientParams.project) {
    throw new Error("project transient is required")
  }

  const now = new Date()
  return {
    id: params.id || randomUUID(),
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: params.deletedAt ?? null,
    organizationId: transientParams.organization.id,
    projectId: transientParams.project.id,
    project: transientParams.project,

    title: params.title || `Document ${sequence}`,
    content: params.content || "Sample content",
    fileName: params.fileName || `file_${sequence}.txt`,
    language: params.language || "en",
    mimeType: params.mimeType || MimeTypes.txt,
    size: params.size || 1024,
    storageRelativePath: params.storageRelativePath || `documents/file_${sequence}.txt`,
    sourceType: params.sourceType || "project",
    embeddingStatus: params.embeddingStatus || "pending",
    embeddingError: params.embeddingError ?? null,
    extractionEngine: params.extractionEngine ?? null,
    tags: params.tags || [],
    uploadStatus: params.uploadStatus || "uploaded",
    evaluationExtractionDatasetDocuments: params.evaluationExtractionDatasetDocuments || [],
    userId: params.userId || null,
  } satisfies Document
})

type CreateDocumentForProjectParams = {
  document?: Partial<Document>
}

type CreateDocumentForProjectRepositories = {
  documentRepository: Repository<Document>
}

export async function createDocumentForProject({
  repositories,
  organization,
  project,
  params = {},
}: {
  repositories: CreateDocumentForProjectRepositories
  organization: Organization
  project: Project
  params?: CreateDocumentForProjectParams
}): Promise<Document> {
  const document = documentFactory.transient({ organization, project }).build(params.document)
  await repositories.documentRepository.save(document)
  return document
}

import { MimeTypes } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { Document } from "./documents.models"

type DocumentTransientParams = {
  project: Project
}

class DocumentFactory extends Factory<Document, DocumentTransientParams> {}

export const documentFactory = DocumentFactory.define(({ params, transientParams }) => {
  const { project } = transientParams
  if (!project) {
    throw new Error("Project must be provided in transient params to build a Document")
  }

  const fileName = params.fileName ?? `${faker.system.commonFileName("pdf")}`
  return {
    id: params.id ?? faker.string.uuid(),
    projectId: project.id,
    title: params.title ?? fileName,
    fileName: params.fileName ?? fileName,
    language: params.language ?? "en",
    mimeType: params.mimeType ?? MimeTypes.pdf,
    size: params.size ?? faker.number.int({ min: 1024, max: 5 * 1024 * 1024 }),
    sourceType: params.sourceType ?? "project",
    embeddingStatus: params.embeddingStatus ?? "completed",
    embeddingError: params.embeddingError ?? null,
    tagIds: params.tagIds ?? [],
    createdAt: params.createdAt ?? faker.date.past().getTime(),
    updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
  }
})

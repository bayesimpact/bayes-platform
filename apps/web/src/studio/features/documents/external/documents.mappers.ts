import type { DocumentDto } from "@caseai-connect/api-contracts"
import type { Document } from "../documents.models"

export function fromDocumentDto(dto: DocumentDto): Document {
  return {
    content: dto.content,
    pages: dto.pages,
    createdAt: dto.createdAt,
    deletedAt: dto.deletedAt,
    fileName: dto.fileName,
    id: dto.id,
    language: dto.language,
    mimeType: dto.mimeType,
    projectId: dto.projectId,
    size: dto.size,
    storageRelativePath: dto.storageRelativePath,
    sourceType: dto.sourceType,
    sourceUrl: dto.sourceUrl,
    embeddingStatus: dto.embeddingStatus,
    embeddingError: dto.embeddingError ?? null,
    title: dto.title,
    updatedAt: dto.updatedAt,
    tagIds: dto.tagIds,
  }
}

/** Sends the file bytes straight to the storage URL a presign call returned. */
export async function putFileToSignedUrl({
  uploadUrl,
  file,
}: {
  uploadUrl: string
  file: File
}): Promise<void> {
  await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  })
}

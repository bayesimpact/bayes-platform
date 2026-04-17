import { MimeTypes } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { Document } from "./documents.models"
import { shouldTriggerResyncForUnknownDocumentEvent } from "./documents-stream-events"

function buildDocument(documentId: string): Document {
  return {
    id: documentId,
    projectId: "project-id",
    title: "Document title",
    content: "",
    fileName: "file.pdf",
    createdAt: 1,
    updatedAt: 1,
    language: "en",
    mimeType: MimeTypes.pdf,
    size: 123,
    storageRelativePath: "/documents/file.pdf",
    sourceType: "project",
    embeddingStatus: "processing",
    embeddingError: null,
    tagIds: [],
  }
}

describe("shouldTriggerResyncForUnknownDocumentEvent", () => {
  it("returns false when document already exists in current list", () => {
    const documentsData: AsyncData<Document[]> = {
      status: ADS.Fulfilled,
      error: null,
      value: [buildDocument("document-1")],
    }

    const shouldResync = shouldTriggerResyncForUnknownDocumentEvent({
      documentsData,
      documentId: "document-1",
      hasTriggeredUnknownDocumentResync: false,
    })

    expect(shouldResync).toBe(false)
  })

  it("returns true once when document is missing", () => {
    const documentsData: AsyncData<Document[]> = {
      status: ADS.Fulfilled,
      error: null,
      value: [buildDocument("document-1")],
    }

    const shouldResync = shouldTriggerResyncForUnknownDocumentEvent({
      documentsData,
      documentId: "document-2",
      hasTriggeredUnknownDocumentResync: false,
    })

    expect(shouldResync).toBe(true)
  })

  it("returns false after unknown-document resync already triggered", () => {
    const documentsData: AsyncData<Document[]> = {
      status: ADS.Fulfilled,
      error: null,
      value: [buildDocument("document-1")],
    }

    const shouldResync = shouldTriggerResyncForUnknownDocumentEvent({
      documentsData,
      documentId: "document-2",
      hasTriggeredUnknownDocumentResync: true,
    })

    expect(shouldResync).toBe(false)
  })

  it("returns true when list is not fulfilled and no previous resync happened", () => {
    const documentsData: AsyncData<Document[]> = {
      status: ADS.Loading,
      error: null,
      value: null,
    }

    const shouldResync = shouldTriggerResyncForUnknownDocumentEvent({
      documentsData,
      documentId: "document-2",
      hasTriggeredUnknownDocumentResync: false,
    })

    expect(shouldResync).toBe(true)
  })
})

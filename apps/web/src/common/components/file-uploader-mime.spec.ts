import {
  allowedDocumentUploadMimeTypesForFileUploader,
  MimeTypes,
} from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { buildAccept } from "./file-uploader-mime"

describe("buildAccept", () => {
  it("keeps only enabled MIME types", () => {
    const accept = buildAccept({ [MimeTypes.pdf]: true, [MimeTypes.png]: false })

    expect(accept).toEqual({ [MimeTypes.pdf]: [] })
  })

  it("adds extension hints for markdown so file pickers list .md files", () => {
    const accept = buildAccept({ [MimeTypes.md]: true })

    expect(accept).toEqual({ [MimeTypes.md]: [".md", ".markdown"] })
  })

  it("accepts markdown in the document upload allow-list", () => {
    const accept = buildAccept(allowedDocumentUploadMimeTypesForFileUploader)

    expect(accept[MimeTypes.md]).toEqual([".md", ".markdown"])
    expect(accept[MimeTypes.pdf]).toEqual([])
  })
})

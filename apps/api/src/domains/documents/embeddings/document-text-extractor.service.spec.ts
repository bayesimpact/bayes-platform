import { UnsupportedMediaTypeException } from "@nestjs/common"
import * as doclingCli from "@/external/docling/docling.cli"
import { DocumentTextExtractorService } from "./document-text-extractor.service"

jest.mock("@/external/docling/docling.cli", () => ({
  extractTextWithDocling: jest.fn(),
  getDoclingVersion: jest.fn(),
  isDoclingEnabled: jest.fn(),
}))

describe("DocumentTextExtractorService", () => {
  const mockExtractTextWithDocling = jest.mocked(doclingCli.extractTextWithDocling)
  const mockGetDoclingVersion = jest.mocked(doclingCli.getDoclingVersion)
  const mockIsDoclingEnabled = jest.mocked(doclingCli.isDoclingEnabled)
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
    mockIsDoclingEnabled.mockReturnValue(true)
    mockGetDoclingVersion.mockResolvedValue("2.51.0")
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("uses the chunker script for text/plain", async () => {
    const extractor = new DocumentTextExtractorService()
    mockExtractTextWithDocling.mockResolvedValue({
      child_chunks: [
        {
          chunk_id: "uuid",
          embed_text: "hello world",
          text: "hello world",
          parent_id: null,
          prev_chunk_id: null,
          next_chunk_id: null,
          headings: [],
          captions: [],
          metadata: {},
        },
      ],
      parent_chunks: [],
    })

    const result = await extractor.extract(Buffer.from("hello world"), "text/plain")

    expect(result).toEqual({
      text: "hello world",
      chunks: ["hello world"],
      doclingChunks: expect.any(Array),
      doclingParentChunks: expect.any(Array),
      extractionEngine: "docling@2.51.0",
    })
    expect(mockExtractTextWithDocling).toHaveBeenCalledTimes(1)
  })

  it("uses docling for supported non-text mime types", async () => {
    const extractor = new DocumentTextExtractorService()
    mockExtractTextWithDocling.mockResolvedValue({
      child_chunks: [
        {
          chunk_id: "uuid",
          embed_text: "# Converted markdown\n",
          text: "# Converted markdown",
          parent_id: null,
          prev_chunk_id: null,
          next_chunk_id: null,
          headings: [],
          captions: [],
          metadata: {},
        },
      ],
      parent_chunks: [],
    })

    const result = await extractor.extract(Buffer.from("fake"), "image/png")

    expect(result).toEqual({
      text: "# Converted markdown",
      chunks: ["# Converted markdown"],
      doclingChunks: expect.any(Array),
      doclingParentChunks: expect.any(Array),
      extractionEngine: "docling@2.51.0",
    })
    expect(mockExtractTextWithDocling).toHaveBeenCalledTimes(1)
  })

  it("throws on unsupported mime types when docling is disabled", async () => {
    mockIsDoclingEnabled.mockReturnValue(false)
    const extractor = new DocumentTextExtractorService()

    await expect(extractor.extract(Buffer.from("fake"), "image/png")).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    )
  })
})

import { createVertex } from "@ai-sdk/google-vertex"
import { EmbeddingModel } from "@caseai-connect/api-contracts"
import { embed, embedMany } from "ai"
import { EmbedderService } from "./embedder.service"

jest.mock("@ai-sdk/google-vertex", () => ({
  createVertex: jest.fn(),
}))

jest.mock("ai", () => ({
  embed: jest.fn(),
  embedMany: jest.fn(),
}))

const fetchMock = jest.fn()

function respondWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

describe("EmbedderService", () => {
  const service = new EmbedderService()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    process.env.GOOGLE_VERTEX_PROJECT = "project-id"
    process.env.GOOGLE_VERTEX_LOCATION = "europe-west1"
    process.env.EMBEDDER_BGE_M3_URL = "http://embedder:3003/"
    process.env.EMBEDDER_BGE_M3_API_KEY = "secret"
    process.env.EMBEDDER_BATCH_SIZE = "2"
    jest.mocked(createVertex).mockReturnValue({
      textEmbeddingModel: jest.fn().mockReturnValue("embedding-model"),
    } as unknown as ReturnType<typeof createVertex>)
  })

  afterEach(() => {
    delete process.env.EMBEDDER_BGE_M3_URL
    delete process.env.EMBEDDER_BGE_M3_API_KEY
    delete process.env.EMBEDDER_BATCH_SIZE
  })

  it("batches Vertex requests to stay under the instance limits", async () => {
    jest.mocked(embedMany).mockImplementation(async ({ values }) => ({
      embeddings: values.map(() => [0.1, 0.2, 0.3]),
      values,
      warnings: [],
      usage: { tokens: 0 },
    }))
    const texts = Array.from({ length: 501 }, (_, index) => `chunk-${index}`)

    const { dense, sparse } = await service.embedDocuments({
      modelName: "gemini-embedding-001",
      texts,
    })

    expect(jest.mocked(embedMany).mock.calls.map(([params]) => params.values.length)).toEqual([
      250, 250, 1,
    ])
    expect(dense).toHaveLength(501)
    expect(sparse).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("embeds a self-hosted model's chunks over HTTP, in batches, with its key", async () => {
    respondWith({
      dimensions: 2,
      dense: [
        [1, 0],
        [0, 1],
      ],
      sparse: [{ "5": 0.3 }, { "9": 0.1 }],
    })
    respondWith({ dimensions: 2, dense: [[1, 1]], sparse: [{ "7": 0.2 }] })

    const embeddings = await service.embedDocuments({
      modelName: EmbeddingModel.BgeM3,
      texts: ["a", "b", "c"],
    })

    expect(embeddings).toEqual({
      dense: [
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      sparse: [{ "5": 0.3 }, { "9": 0.1 }, { "7": 0.2 }],
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://embedder:3003/v1/embed")
    expect(init.headers).toEqual(expect.objectContaining({ authorization: "Bearer secret" }))
    expect(JSON.parse(String(init.body))).toEqual({
      model: EmbeddingModel.BgeM3,
      texts: ["a", "b"],
      input_type: "document",
    })
  })

  it("embeds a query over HTTP and returns its lexical weights", async () => {
    respondWith({ dimensions: 2, dense: [[0.4, 0.5]], sparse: [{ "12": 0.2 }] })

    const queryEmbedding = await service.embedQuery({
      modelName: EmbeddingModel.BgeM3,
      text: "question",
    })

    expect(queryEmbedding).toEqual({ embedding: [0.4, 0.5], sparseEmbedding: { "12": 0.2 } })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body)).input_type).toBe("query")
  })

  it("embeds a query with Vertex for any other model", async () => {
    jest.mocked(embed).mockResolvedValue({ embedding: [0.1] } as never)

    await expect(
      service.embedQuery({ modelName: "gemini-embedding-001", text: "question" }),
    ).resolves.toEqual({ embedding: [0.1], sparseEmbedding: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects with the embedder's status when the request fails", async () => {
    respondWith({ detail: "model not loaded" }, 503)

    await expect(
      service.embedDocuments({ modelName: EmbeddingModel.BgeM3, texts: ["a"] }),
    ).rejects.toThrow("Embedder BAAI/bge-m3 answered 503")
  })

  it("rejects a response with fewer vectors than texts", async () => {
    respondWith({ dimensions: 2, dense: [[1, 0]], sparse: null })

    await expect(
      service.embedDocuments({ modelName: EmbeddingModel.BgeM3, texts: ["a", "b"] }),
    ).rejects.toThrow("returned 1 vectors for 2 texts")
  })

  it("refuses a self-hosted model the deployment has no URL for", async () => {
    delete process.env.EMBEDDER_BGE_M3_URL

    expect(service.isAvailable(EmbeddingModel.BgeM3)).toBe(false)
    expect(service.isAvailable("gemini-embedding-001")).toBe(true)
    await expect(
      service.embedQuery({ modelName: EmbeddingModel.BgeM3, text: "question" }),
    ).rejects.toThrow("set EMBEDDER_BGE_M3_URL")
  })
})

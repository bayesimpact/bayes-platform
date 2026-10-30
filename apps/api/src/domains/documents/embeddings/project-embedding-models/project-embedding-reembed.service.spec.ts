import { EmbeddingModel } from "@caseai-connect/api-contracts"
import type { EmbedderService } from "../embedders/embedder.service"
import type { DocumentChunkEmbeddingRepository } from "./document-chunk-embedding.repository"
import type { ProjectEmbeddingModelsService } from "./project-embedding-models.service"
import { ProjectEmbeddingReembedService } from "./project-embedding-reembed.service"

const payload = {
  projectEmbeddingModelId: "row-1",
  organizationId: "organization-1",
  projectId: "project-1",
  modelName: EmbeddingModel.BgeM3,
}

function buildChunk(index: number) {
  return {
    id: `chunk-${index}`,
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    embedText: `text ${index}`,
  }
}

function buildService() {
  const modelsService = {
    findById: jest.fn().mockResolvedValue({ id: "row-1" }),
    markProcessing: jest.fn().mockResolvedValue(undefined),
    updateProgress: jest.fn().mockResolvedValue(undefined),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  }
  const chunkRepository = {
    countEligibleChunks: jest.fn(),
    countChunksMissingEmbedding: jest.fn(),
    findChunksMissingEmbedding: jest.fn(),
    insertEmbeddingsIgnoringConflicts: jest.fn(),
  }
  const embedder = {
    assertAvailable: jest.fn(),
    embedDocuments: jest.fn(),
  }
  const service = new ProjectEmbeddingReembedService(
    modelsService as unknown as ProjectEmbeddingModelsService,
    chunkRepository as unknown as DocumentChunkEmbeddingRepository,
    embedder as unknown as EmbedderService,
  )
  return { service, modelsService, chunkRepository, embedder }
}

describe("ProjectEmbeddingReembedService", () => {
  beforeEach(() => {
    process.env.EMBEDDER_BATCH_SIZE = "2"
  })

  afterEach(() => {
    delete process.env.EMBEDDER_BATCH_SIZE
  })

  it("embeds the missing chunks in batches, reports progress and completes", async () => {
    const { service, modelsService, chunkRepository, embedder } = buildService()
    chunkRepository.countEligibleChunks.mockResolvedValue(3)
    // One chunk was already embedded by an upload that ran while the model was pending.
    chunkRepository.countChunksMissingEmbedding.mockResolvedValueOnce(2).mockResolvedValueOnce(0)
    chunkRepository.findChunksMissingEmbedding
      .mockResolvedValueOnce([buildChunk(1), buildChunk(2)])
      .mockResolvedValueOnce([])
    embedder.embedDocuments.mockResolvedValue([[0.1], [0.2]])
    chunkRepository.insertEmbeddingsIgnoringConflicts.mockResolvedValue(2)

    await service.reembedProjectChunks(payload)

    expect(embedder.assertAvailable).toHaveBeenCalledWith(EmbeddingModel.BgeM3)
    expect(modelsService.markProcessing).toHaveBeenCalledWith({
      id: "row-1",
      totalChunks: 3,
      processedChunks: 1,
    })
    expect(chunkRepository.findChunksMissingEmbedding).toHaveBeenCalledWith({
      projectId: "project-1",
      modelName: EmbeddingModel.BgeM3,
      limit: 2,
    })
    expect(embedder.embedDocuments).toHaveBeenCalledWith({
      modelName: EmbeddingModel.BgeM3,
      texts: ["text 1", "text 2"],
    })
    expect(chunkRepository.insertEmbeddingsIgnoringConflicts).toHaveBeenCalledWith([
      expect.objectContaining({
        chunkId: "chunk-1",
        modelName: EmbeddingModel.BgeM3,
        embedding: [0.1],
      }),
      expect.objectContaining({
        chunkId: "chunk-2",
        embedding: [0.2],
      }),
    ])
    expect(modelsService.updateProgress).toHaveBeenCalledWith({ id: "row-1", processedChunks: 3 })
    expect(modelsService.markCompleted).toHaveBeenCalledWith({
      id: "row-1",
      totalChunks: 3,
      processedChunks: 3,
    })
    expect(modelsService.markFailed).not.toHaveBeenCalled()
  })

  it("marks the model failed and rethrows when the embedder fails", async () => {
    const { service, modelsService, chunkRepository, embedder } = buildService()
    chunkRepository.countEligibleChunks.mockResolvedValue(1)
    chunkRepository.countChunksMissingEmbedding.mockResolvedValue(1)
    chunkRepository.findChunksMissingEmbedding.mockResolvedValueOnce([buildChunk(1)])
    const failure = new Error("embedder exited")
    embedder.embedDocuments.mockRejectedValue(failure)

    await expect(service.reembedProjectChunks(payload)).rejects.toBe(failure)

    expect(modelsService.markFailed).toHaveBeenCalledWith({ id: "row-1", error: failure })
    expect(modelsService.markCompleted).not.toHaveBeenCalled()
  })

  it("marks the model failed when its embedder is not configured", async () => {
    const { service, modelsService, embedder } = buildService()
    const disabled = new Error("Embedder BAAI/bge-m3 is not configured on this deployment")
    embedder.assertAvailable.mockImplementation(() => {
      throw disabled
    })

    await expect(service.reembedProjectChunks(payload)).rejects.toBe(disabled)

    expect(modelsService.markFailed).toHaveBeenCalledWith({ id: "row-1", error: disabled })
  })

  it("does nothing when the row no longer exists", async () => {
    const { service, modelsService, embedder } = buildService()
    modelsService.findById.mockResolvedValue(null)

    await service.reembedProjectChunks(payload)

    expect(embedder.assertAvailable).not.toHaveBeenCalled()
    expect(modelsService.markProcessing).not.toHaveBeenCalled()
  })
})

import { EmbeddingModel } from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common"
import type { EmbedderService } from "../embedders/embedder.service"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"
import type { ProjectEmbeddingModelRepository } from "./project-embedding-model.repository"
import { ProjectEmbeddingModelsService } from "./project-embedding-models.service"
import type { ProjectEmbeddingReembedBatchService } from "./project-embedding-reembed-batch.interface"

const connectScope = { organizationId: "organization-1", projectId: "project-1" }

function buildRow(overrides: Partial<ProjectEmbeddingModel> = {}): ProjectEmbeddingModel {
  return {
    id: "row-1",
    organizationId: connectScope.organizationId,
    projectId: connectScope.projectId,
    modelName: EmbeddingModel.BgeM3,
    status: "pending",
    totalChunks: 0,
    processedChunks: 0,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as ProjectEmbeddingModel
}

function buildService() {
  const repository = {
    findAllByScope: jest.fn(),
    findOneByModelName: jest.fn(),
    listActiveModelNames: jest.fn(),
    isCompleted: jest.fn(),
    createPending: jest.fn(),
    updateProgress: jest.fn(),
  }
  const batchService = {
    enqueueReembedProjectChunks: jest.fn().mockResolvedValue(undefined),
    isReembedJobQueued: jest.fn().mockResolvedValue(true),
  }
  const embedderService = { isAvailable: jest.fn().mockReturnValue(true) }
  const service = new ProjectEmbeddingModelsService(
    repository as unknown as ProjectEmbeddingModelRepository,
    batchService as unknown as ProjectEmbeddingReembedBatchService,
    embedderService as unknown as EmbedderService,
  )
  return { service, repository, batchService, embedderService }
}

describe("ProjectEmbeddingModelsService", () => {
  describe("enable", () => {
    it("refuses a model that is not served locally", async () => {
      const { service, repository } = buildService()

      await expect(
        service.enable({ connectScope, modelName: EmbeddingModel.GeminiEmbedding001 }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(repository.createPending).not.toHaveBeenCalled()
    })

    it("refuses a model the deployment has no embedder for", async () => {
      const { service, repository, embedderService } = buildService()
      embedderService.isAvailable.mockReturnValue(false)

      await expect(
        service.enable({ connectScope, modelName: EmbeddingModel.BgeM3 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(repository.createPending).not.toHaveBeenCalled()
    })

    it("creates a pending row for a new model and enqueues the re-embedding job", async () => {
      const { service, repository, batchService } = buildService()
      repository.findOneByModelName.mockResolvedValue(null)
      const created = buildRow()
      repository.createPending.mockResolvedValue(created)

      const row = await service.enable({ connectScope, modelName: EmbeddingModel.BgeM3 })

      expect(row).toBe(created)
      expect(repository.createPending).toHaveBeenCalledWith(connectScope, EmbeddingModel.BgeM3)
      expect(batchService.enqueueReembedProjectChunks).toHaveBeenCalledWith({
        projectEmbeddingModelId: created.id,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        modelName: EmbeddingModel.BgeM3,
      })
    })

    it("returns a completed model as is without a new job", async () => {
      const { service, repository, batchService } = buildService()
      const completed = buildRow({ status: "completed" })
      repository.findOneByModelName.mockResolvedValue(completed)

      const row = await service.enable({ connectScope, modelName: EmbeddingModel.BgeM3 })

      expect(row).toBe(completed)
      expect(repository.createPending).not.toHaveBeenCalled()
      expect(repository.updateProgress).not.toHaveBeenCalled()
      expect(batchService.enqueueReembedProjectChunks).not.toHaveBeenCalled()
    })

    it.each(["pending", "processing"] as const)("refuses a model that is %s", async (status) => {
      const { service, repository } = buildService()
      repository.findOneByModelName.mockResolvedValue(buildRow({ status }))

      await expect(
        service.enable({ connectScope, modelName: EmbeddingModel.BgeM3 }),
      ).rejects.toBeInstanceOf(ConflictException)
    })

    it.each([
      "pending",
      "processing",
    ] as const)("re-queues a %s model whose job is gone", async (status) => {
      const { service, repository, batchService } = buildService()
      repository.findOneByModelName.mockResolvedValue(buildRow({ status }))
      batchService.isReembedJobQueued.mockResolvedValue(false)
      repository.updateProgress.mockResolvedValue(buildRow({ status: "pending" }))

      await service.enable({ connectScope, modelName: EmbeddingModel.BgeM3 })

      expect(batchService.isReembedJobQueued).toHaveBeenCalledWith("row-1")
      expect(batchService.enqueueReembedProjectChunks).toHaveBeenCalledTimes(1)
    })

    it("marks the model failed when the job cannot be queued, so it can be retried", async () => {
      const { service, repository, batchService } = buildService()
      repository.findOneByModelName.mockResolvedValue(null)
      repository.createPending.mockResolvedValue(buildRow())
      const enqueueError = new Error("Redis unavailable")
      batchService.enqueueReembedProjectChunks.mockRejectedValue(enqueueError)

      await expect(service.enable({ connectScope, modelName: EmbeddingModel.BgeM3 })).rejects.toBe(
        enqueueError,
      )

      expect(repository.updateProgress).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ status: "failed", error: "Redis unavailable" }),
      )
    })

    it("resets a failed model to pending and retries the job", async () => {
      const { service, repository, batchService } = buildService()
      repository.findOneByModelName.mockResolvedValue(buildRow({ status: "failed", error: "boom" }))
      const reset = buildRow({ status: "pending" })
      repository.updateProgress.mockResolvedValue(reset)

      const row = await service.enable({ connectScope, modelName: EmbeddingModel.BgeM3 })

      expect(row).toBe(reset)
      expect(repository.updateProgress).toHaveBeenCalledWith("row-1", {
        status: "pending",
        error: null,
        totalChunks: 0,
        processedChunks: 0,
      })
      expect(batchService.enqueueReembedProjectChunks).toHaveBeenCalledTimes(1)
    })
  })

  describe("markFailed", () => {
    it("truncates the failure message", async () => {
      const { service, repository } = buildService()

      await service.markFailed({ id: "row-1", error: new Error("x".repeat(3000)) })

      const fields = repository.updateProgress.mock.calls[0]?.[1]
      expect(fields.status).toBe("failed")
      expect(fields.error).toHaveLength(2000)
    })
  })
})

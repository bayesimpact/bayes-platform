import { EmbeddingModel } from "@caseai-connect/api-contracts"
import type { DataSource } from "typeorm"
import type { DocumentsService } from "../documents.service"
import type { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DocumentEmbeddingsSharedService } from "./document-embeddings-shared.service"
import type { EmbedderService } from "./embedders/embedder.service"
import type { ProjectEmbeddingModelsService } from "./project-embedding-models/project-embedding-models.service"

const scope = { documentId: "document-1", organizationId: "organization-1", projectId: "project-1" }
const connectScope = { organizationId: scope.organizationId, projectId: scope.projectId }

function buildSharedService() {
  const dataSource = { query: jest.fn().mockResolvedValue([]) }
  const projectEmbeddingModelsService = {
    listActiveModelNames: jest.fn().mockResolvedValue([EmbeddingModel.GeminiEmbedding001]),
  }
  const embedderService = {
    embedDocuments: jest.fn(async ({ texts }: { modelName: string; texts: string[] }) =>
      texts.map(() => [0.1, 0.2]),
    ),
  }
  const service = new DocumentEmbeddingsSharedService(
    {} as DocumentsService,
    {} as DocumentEmbeddingStatusNotifierService,
    dataSource as unknown as DataSource,
    projectEmbeddingModelsService as unknown as ProjectEmbeddingModelsService,
    embedderService as unknown as EmbedderService,
  )
  return { service, dataSource, projectEmbeddingModelsService, embedderService }
}

function embeddingModelNamesInserted(dataSource: { query: jest.Mock }): unknown[] {
  return dataSource.query.mock.calls
    .filter(([sql]) => String(sql).includes("INSERT INTO document_chunk_embedding"))
    .map(([, parameters]) => (parameters as unknown[])[3])
}

describe("DocumentEmbeddingsSharedService", () => {
  it("embeds the chunks with every model the project enabled", async () => {
    const { service, projectEmbeddingModelsService, embedderService } = buildSharedService()
    projectEmbeddingModelsService.listActiveModelNames.mockResolvedValue([
      EmbeddingModel.GeminiEmbedding001,
      EmbeddingModel.BgeM3,
    ])

    const embeddingsByModelName = await service.generateEmbeddingsByModel({
      chunks: ["first", "second"],
      connectScope,
    })

    expect(embedderService.embedDocuments.mock.calls.map(([params]) => params.modelName)).toEqual([
      "gemini-embedding-001",
      EmbeddingModel.BgeM3,
    ])
    expect([...embeddingsByModelName.keys()]).toEqual([
      "gemini-embedding-001",
      EmbeddingModel.BgeM3,
    ])
    expect(embeddingsByModelName.get(EmbeddingModel.BgeM3)).toHaveLength(2)
  })

  it("fails when an enabled embedder fails, so the document keeps one set of chunks", async () => {
    const { service, projectEmbeddingModelsService, embedderService } = buildSharedService()
    projectEmbeddingModelsService.listActiveModelNames.mockResolvedValue([
      EmbeddingModel.GeminiEmbedding001,
      EmbeddingModel.BgeM3,
    ])
    embedderService.embedDocuments.mockImplementation(async ({ modelName, texts }) => {
      if (modelName === EmbeddingModel.BgeM3) {
        throw new Error("Embedder BAAI/bge-m3 answered 503")
      }
      return texts.map(() => [0.1])
    })

    await expect(
      service.generateEmbeddingsByModel({ chunks: ["first"], connectScope }),
    ).rejects.toThrow("answered 503")
  })

  it("also embeds with a model the project enabled while the document was processing", async () => {
    const { service, dataSource, projectEmbeddingModelsService, embedderService } =
      buildSharedService()
    const embeddingsByModelName = await service.generateEmbeddingsByModel({
      chunks: ["first"],
      connectScope,
    })
    projectEmbeddingModelsService.listActiveModelNames.mockResolvedValue([
      EmbeddingModel.GeminiEmbedding001,
      EmbeddingModel.BgeM3,
    ])

    await service.insertChunks({ scope, chunks: ["first"], embeddingsByModelName })

    expect(embedderService.embedDocuments).toHaveBeenLastCalledWith({
      modelName: EmbeddingModel.BgeM3,
      texts: ["first"],
    })
    expect(embeddingModelNamesInserted(dataSource)).toEqual([
      "gemini-embedding-001",
      EmbeddingModel.BgeM3,
    ])
  })
})

import { EmbeddingModel } from "@caseai-connect/api-contracts"
import type { DataSource } from "typeorm"
import type { DocumentsService } from "../documents.service"
import type { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DocumentEmbeddingsSharedService } from "./document-embeddings-shared.service"
import type { EmbedderService } from "./embedders/embedder.service"
import type { ProjectEmbeddingModelRepository } from "./project-embedding-models/project-embedding-model.repository"

const scope = { documentId: "document-1", organizationId: "organization-1", projectId: "project-1" }

function buildSharedService() {
  const dataSource = { query: jest.fn().mockResolvedValue([]) }
  const projectEmbeddingModelRepository = { listActiveModelNames: jest.fn().mockResolvedValue([]) }
  const embedderService = {
    embedDocuments: jest.fn(async ({ texts }: { modelName: string; texts: string[] }) =>
      texts.map(() => [0.1, 0.2]),
    ),
  }
  const service = new DocumentEmbeddingsSharedService(
    {} as DocumentsService,
    {} as DocumentEmbeddingStatusNotifierService,
    dataSource as unknown as DataSource,
    projectEmbeddingModelRepository as unknown as ProjectEmbeddingModelRepository,
    embedderService as unknown as EmbedderService,
  )
  return { service, dataSource, projectEmbeddingModelRepository, embedderService }
}

function embeddingModelNamesInserted(dataSource: { query: jest.Mock }): unknown[] {
  return dataSource.query.mock.calls
    .filter(([sql]) => String(sql).includes("INSERT INTO document_chunk_embedding"))
    .map(([, parameters]) => (parameters as unknown[])[3])
}

describe("DocumentEmbeddingsSharedService", () => {
  beforeEach(() => {
    process.env.DOCUMENT_EMBEDDING_MODELS = "gemini-embedding-001"
  })

  it("embeds the chunks with the Vertex models and the project's enabled models", async () => {
    const { service, projectEmbeddingModelRepository, embedderService } = buildSharedService()
    projectEmbeddingModelRepository.listActiveModelNames.mockResolvedValue([EmbeddingModel.BgeM3])

    const embeddingsByModelName = await service.generateEmbeddingsByModel({
      chunks: ["first", "second"],
      projectId: scope.projectId,
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
    const { service, projectEmbeddingModelRepository, embedderService } = buildSharedService()
    projectEmbeddingModelRepository.listActiveModelNames.mockResolvedValue([EmbeddingModel.BgeM3])
    embedderService.embedDocuments.mockImplementation(async ({ modelName, texts }) => {
      if (modelName === EmbeddingModel.BgeM3) {
        throw new Error("Embedder BAAI/bge-m3 answered 503")
      }
      return texts.map(() => [0.1])
    })

    await expect(
      service.generateEmbeddingsByModel({ chunks: ["first"], projectId: scope.projectId }),
    ).rejects.toThrow("answered 503")
  })

  it("also embeds with a model the project enabled while the document was processing", async () => {
    const { service, dataSource, projectEmbeddingModelRepository, embedderService } =
      buildSharedService()
    const embeddingsByModelName = await service.generateEmbeddingsByModel({
      chunks: ["first"],
      projectId: scope.projectId,
    })
    projectEmbeddingModelRepository.listActiveModelNames.mockResolvedValue([EmbeddingModel.BgeM3])

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

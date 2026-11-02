import type { ProjectEmbeddingReembedService } from "./project-embedding-reembed.service"
import { ProjectEmbeddingReembedWorker } from "./project-embedding-reembed.worker"

describe("ProjectEmbeddingReembedWorker", () => {
  it("delegates the job payload to the re-embedding service", async () => {
    const reembedService = { reembedProjectChunks: jest.fn().mockResolvedValue(undefined) }
    const worker = new ProjectEmbeddingReembedWorker(
      reembedService as unknown as ProjectEmbeddingReembedService,
    )
    const data = {
      projectEmbeddingModelId: "row-1",
      organizationId: "organization-1",
      projectId: "project-1",
      modelName: "BAAI/bge-m3",
    }

    await worker.process({ data } as never)

    expect(reembedService.reembedProjectChunks).toHaveBeenCalledWith(data)
  })
})

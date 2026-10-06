import type { LocalEmbeddingBridgeService } from "@/external/local-embeddings/local-embedding-bridge.service"
import { QueryEmbeddingsWorker } from "./query-embeddings.worker"

describe("QueryEmbeddingsWorker", () => {
  it("embeds the query with the local bridge and returns the vector as the job result", async () => {
    const bridge = {
      embed: jest.fn().mockResolvedValue({ dense: [[0.1, 0.2]], sparse: [{ "17": 0.4 }] }),
    }
    const worker = new QueryEmbeddingsWorker(bridge as unknown as LocalEmbeddingBridgeService)

    const result = await worker.process({
      id: "job-1",
      data: { modelName: "BAAI/bge-m3", text: "question" },
    } as never)

    expect(bridge.embed).toHaveBeenCalledWith({
      modelName: "BAAI/bge-m3",
      texts: ["question"],
      inputType: "query",
    })
    expect(result).toEqual({ embedding: [0.1, 0.2], sparseEmbedding: { "17": 0.4 } })
  })

  it("fails the job when the bridge returns no vector", async () => {
    const bridge = { embed: jest.fn().mockResolvedValue({ dense: [], sparse: null }) }
    const worker = new QueryEmbeddingsWorker(bridge as unknown as LocalEmbeddingBridgeService)

    await expect(
      worker.process({ id: "job-1", data: { modelName: "BAAI/bge-m3", text: "q" } } as never),
    ).rejects.toThrow("no vector")
  })
})

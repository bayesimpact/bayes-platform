import { LocalEmbeddingBridgeService } from "./local-embedding-bridge.service"

/**
 * A stand-in for document_embedder.py: reads JSON lines, answers each with a vector per text,
 * and errors on the model named "broken". Written inline so the spec needs no Python.
 */
const FAKE_EMBEDDER_SCRIPT = `
const readline = require("node:readline")
const rl = readline.createInterface({ input: process.stdin })
rl.on("line", (line) => {
  const request = JSON.parse(line)
  if (request.model === "broken") {
    process.stdout.write(JSON.stringify({ id: request.id, error: "cannot load" }) + "\\n")
    return
  }
  if (request.model === "crash") {
    process.exit(3)
  }
  const embeddings = request.texts.map((text, index) => [text.length, index])
  if (request.model === "sparse-model") {
    const sparse_embeddings = request.texts.map((text) => ({ [String(text.length)]: 0.5 }))
    process.stdout.write(
      JSON.stringify({ id: request.id, model: request.model, dimensions: 2, embeddings, sparse_embeddings }) + "\\n",
    )
    return
  }
  process.stdout.write(
    JSON.stringify({ id: request.id, model: request.model, dimensions: 2, embeddings }) + "\\n",
  )
})
`

describe("LocalEmbeddingBridgeService", () => {
  let service: LocalEmbeddingBridgeService

  beforeEach(() => {
    process.env.LOCAL_EMBEDDINGS_ENABLED = "true"
    process.env.DOCUMENT_EMBEDDER_COMMAND = process.execPath
    process.env.LOCAL_EMBEDDING_REQUEST_TIMEOUT_MS = "5000"
    service = new LocalEmbeddingBridgeService()
    // The bridge runs `<command> --serve`; make node evaluate the fake script instead.
    jest.spyOn(service as never, "getOrSpawnChild" as never).mockImplementation(function (
      this: LocalEmbeddingBridgeService,
    ) {
      const bridge = this as unknown as {
        child: unknown
        onStdout: (data: string) => void
        onChildGone: (reason: string) => void
      }
      if (bridge.child) return bridge.child
      const { spawn } = require("node:child_process") as typeof import("node:child_process")
      const child = spawn(process.execPath, ["-e", FAKE_EMBEDDER_SCRIPT], {
        stdio: ["pipe", "pipe", "pipe"],
      })
      child.stdout.setEncoding("utf8")
      child.stdout.on("data", (data: string) => bridge.onStdout(data))
      child.on("exit", (code) => bridge.onChildGone(`exit ${code}`))
      bridge.child = child
      return child
    } as never)
  })

  afterEach(() => {
    service.onModuleDestroy()
    delete process.env.LOCAL_EMBEDDINGS_ENABLED
    delete process.env.DOCUMENT_EMBEDDER_COMMAND
    delete process.env.LOCAL_EMBEDDING_REQUEST_TIMEOUT_MS
  })

  it("refuses to embed when local embeddings are disabled", async () => {
    process.env.LOCAL_EMBEDDINGS_ENABLED = "false"

    await expect(
      service.embed({ modelName: "m", texts: ["a"], inputType: "document" }),
    ).rejects.toThrow("not enabled")
  })

  it("returns one vector per text and matches concurrent responses by id", async () => {
    const [first, second] = await Promise.all([
      service.embed({ modelName: "m", texts: ["ab", "abc"], inputType: "document" }),
      service.embed({ modelName: "m", texts: ["a"], inputType: "query" }),
    ])

    expect(first).toEqual({
      dense: [
        [2, 0],
        [3, 1],
      ],
      sparse: null,
    })
    expect(second).toEqual({ dense: [[1, 0]], sparse: null })
  })

  it("returns the lexical weights when the model produces them", async () => {
    await expect(
      service.embed({ modelName: "sparse-model", texts: ["abc"], inputType: "document" }),
    ).resolves.toEqual({ dense: [[3, 0]], sparse: [{ "3": 0.5 }] })
  })

  it("rejects with the embedder error message", async () => {
    await expect(
      service.embed({ modelName: "broken", texts: ["a"], inputType: "document" }),
    ).rejects.toThrow("cannot load")
  })

  it("rejects pending requests when the embedder dies and recovers on the next call", async () => {
    await expect(
      service.embed({ modelName: "crash", texts: ["a"], inputType: "document" }),
    ).rejects.toThrow("Local embedding failed")

    await expect(
      service.embed({ modelName: "m", texts: ["abcd"], inputType: "document" }),
    ).resolves.toEqual({ dense: [[4, 0]], sparse: null })
  })

  it("returns an empty list for no texts without touching the embedder", async () => {
    await expect(
      service.embed({ modelName: "m", texts: [], inputType: "document" }),
    ).resolves.toEqual({ dense: [], sparse: null })
  })
})

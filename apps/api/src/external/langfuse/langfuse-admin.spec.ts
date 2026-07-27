import { LangfuseAdminService } from "./langfuse-admin"

describe("LangfuseAdminService", () => {
  const originalEnv = {
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
    LANGFUSE_PK: process.env.LANGFUSE_PK,
    LANGFUSE_SK: process.env.LANGFUSE_SK,
  }
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.LANGFUSE_BASE_URL = "https://langfuse.example.test"
    process.env.LANGFUSE_PK = "pk-sample"
    process.env.LANGFUSE_SK = "sk-sample"
  })

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    global.fetch = originalFetch
  })

  it("deletes a trace with basic auth", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = fetchMock as unknown as typeof fetch

    const deleted = await new LangfuseAdminService().deleteTrace("trace-1")

    expect(deleted).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://langfuse.example.test/api/public/traces/trace-1",
      expect.objectContaining({
        method: "DELETE",
        headers: {
          Authorization: `Basic ${Buffer.from("pk-sample:sk-sample").toString("base64")}`,
        },
      }),
    )
  })

  it("treats an already-deleted trace as success", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch
    await expect(new LangfuseAdminService().deleteTrace("trace-1")).resolves.toBe(true)
  })

  it("throws on other HTTP errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    }) as unknown as typeof fetch
    await expect(new LangfuseAdminService().deleteTrace("trace-1")).rejects.toThrow(
      "Langfuse trace deletion failed",
    )
  })

  it("skips silently when Langfuse is not configured", async () => {
    delete process.env.LANGFUSE_BASE_URL
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    await expect(new LangfuseAdminService().deleteTrace("trace-1")).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

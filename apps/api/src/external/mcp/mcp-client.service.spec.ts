import { createMCPClient } from "@ai-sdk/mcp"
import { Logger } from "@nestjs/common"
import { McpClientService } from "./mcp-client.service"

jest.mock("@ai-sdk/mcp", () => ({
  createMCPClient: jest.fn(),
}))

describe("McpClientService", () => {
  const buildService = () => new McpClientService()

  const transportHeaders = (): Record<string, string> | undefined => {
    const [firstCall] = jest.mocked(createMCPClient).mock.calls
    if (!firstCall) throw new Error("createMCPClient was not called")
    const { transport } = firstCall[0]
    return (transport as { headers?: Record<string, string> }).headers
  }

  beforeEach(() => {
    jest.mocked(createMCPClient).mockReset()
    jest.mocked(createMCPClient).mockResolvedValue({
      tools: async () => ({}),
      close: async () => {},
      readResource: async () => ({ contents: [] }),
    } as unknown as Awaited<ReturnType<typeof createMCPClient>>)
  })

  it("should not send an authorization header when no api key is configured", async () => {
    await buildService().connect({ url: "https://tools.example.test/mcp" })

    expect(transportHeaders()).toBeUndefined()
  })

  it("should degrade to an empty toolset when the server cannot be reached", async () => {
    // The failure is logged by design; keep it out of the test output.
    const loggedError = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {})
    jest.mocked(createMCPClient).mockRejectedValue(new Error("connection refused"))

    const session = await buildService().connect({ url: "https://tools.example.test/mcp" })

    expect(session.tools).toEqual({})
    expect(loggedError).toHaveBeenCalled()
    loggedError.mockRestore()
  })
})

import { createMCPClient } from "@ai-sdk/mcp"
import { Logger } from "@nestjs/common"
import type { GoogleIdTokenService } from "@/external/google-iam"
import { McpClientService } from "./mcp-client.service"

jest.mock("@ai-sdk/mcp", () => ({
  createMCPClient: jest.fn(),
}))

describe("McpClientService", () => {
  const getAuthorizationHeader = jest.fn()
  const googleIdTokenService = { getAuthorizationHeader } as unknown as GoogleIdTokenService

  const buildService = () => new McpClientService(googleIdTokenService)

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
    getAuthorizationHeader.mockReset()
    getAuthorizationHeader.mockResolvedValue("Bearer google-id-token")
  })

  it("should not send an authorization header when no audience is given", async () => {
    await buildService().connect({ url: "https://tools.example.test/mcp" })

    expect(getAuthorizationHeader).not.toHaveBeenCalled()
    expect(transportHeaders()).toBeUndefined()
  })

  it("should send a minted ID token for an IAM-protected server", async () => {
    await buildService().connect({
      url: "https://tools.example.test/mcp",
      googleIamAudience: "https://tools.example.test",
    })

    expect(getAuthorizationHeader).toHaveBeenCalledWith("https://tools.example.test")
    expect(transportHeaders()).toEqual({ Authorization: "Bearer google-id-token" })
  })

  it("should let the minted ID token override a configured api key", async () => {
    await buildService().connect({
      url: "https://tools.example.test/mcp",
      apiKey: "sk-configured-key",
      googleIamAudience: "https://tools.example.test",
    })

    expect(transportHeaders()).toEqual({ Authorization: "Bearer google-id-token" })
  })

  it("should degrade to an empty toolset when the token cannot be minted", async () => {
    // The failure is logged by design; keep it out of the test output.
    const loggedError = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {})
    getAuthorizationHeader.mockRejectedValue(new Error("no credentials"))

    const session = await buildService().connect({
      url: "https://tools.example.test/mcp",
      googleIamAudience: "https://tools.example.test",
    })

    expect(session.tools).toEqual({})
    expect(createMCPClient).not.toHaveBeenCalled()
    expect(loggedError).toHaveBeenCalled()
    loggedError.mockRestore()
  })
})

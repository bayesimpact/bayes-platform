import dns, { type LookupAddress } from "node:dns"
import { Logger } from "@nestjs/common"
import type { GoogleIdTokenService } from "@/external/google-iam"
import { McpClientService } from "./mcp-client.service"

/**
 * The real MCP client and transport of a server on a public address, with only the DNS answer
 * faked: the connection itself must refuse a private address.
 */
describe("McpClientService - server on a public address", () => {
  const service = new McpClientService({} as GoogleIdTokenService)

  const answerWith = (...addresses: LookupAddress[]) =>
    jest
      .spyOn(dns, "lookup")
      .mockImplementation(((
        _hostname: string,
        _options: unknown,
        callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
      ) => callback(null, addresses)) as unknown as typeof dns.lookup)

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await service.onModuleDestroy()
  })

  it.each([
    { address: "10.0.0.12", family: 4 },
    { address: "169.254.169.254", family: 4 },
    { address: "::ffff:7f00:1", family: 6 },
  ])("refuses a name that resolves to $address at connection time", async (answer) => {
    const lookup = answerWith(answer)

    const inspection = await service.inspect({
      url: "https://rebinding.example.test/mcp",
      publicAddressesOnly: true,
    })

    expect(lookup).toHaveBeenCalled()
    expect(inspection).toEqual({
      isConnected: false,
      error: expect.objectContaining({ code: "urlNotAllowed", httpStatus: null }),
    })
  })

  it("refuses a private address written in the URL", async () => {
    const lookup = jest.spyOn(dns, "lookup")

    const inspection = await service.inspect({
      url: "https://[::ffff:a9fe:a9fe]/mcp",
      publicAddressesOnly: true,
    })

    expect(lookup).not.toHaveBeenCalled()
    expect(inspection).toEqual({
      isConnected: false,
      error: expect.objectContaining({ code: "urlNotAllowed" }),
    })
  })
})

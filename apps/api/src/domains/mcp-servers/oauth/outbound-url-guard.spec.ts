import { lookup } from "node:dns/promises"
import {
  assertAllowedOutboundUrl,
  DisallowedOutboundUrlError,
  isAllowedOutboundUrl,
  isPrivateOrLocalAddress,
} from "./outbound-url-guard"

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }))
const lookupMock = lookup as jest.Mock

const PUBLIC_V4 = { address: "93.184.216.34", family: 4 }
const PUBLIC_V6 = { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }

describe("isPrivateOrLocalAddress", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.254",
    "0.0.0.0",
    "0.1.2.3",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "::",
    "::1",
    "[::1]",
    "fe80::1",
    "febf::1",
    "fe80::1%eth0",
    "fc00::1",
    "fd12:3456:789a::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
  ])("treats %s as private or local", (address) => {
    expect(isPrivateOrLocalAddress(address)).toBe(true)
  })

  it.each([
    "93.184.216.34",
    "8.8.8.8",
    "172.15.255.255",
    "172.32.0.1",
    "192.169.0.1",
    "11.0.0.1",
    "2606:2800:220:1:248:1893:25c8:1946",
    "2001:db8::1",
    "::ffff:93.184.216.34",
    "fec0::1",
  ])("treats %s as public", (address) => {
    expect(isPrivateOrLocalAddress(address)).toBe(false)
  })

  it("treats unparseable input as private", () => {
    expect(isPrivateOrLocalAddress("not-an-ip")).toBe(true)
    expect(isPrivateOrLocalAddress("")).toBe(true)
  })
})

describe("assertAllowedOutboundUrl", () => {
  const originalFlag = process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL

  beforeEach(() => {
    lookupMock.mockReset()
    lookupMock.mockResolvedValue([PUBLIC_V4, PUBLIC_V6])
    delete process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL
  })

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL
    else process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL = originalFlag
  })

  it("accepts an https URL whose host resolves to public addresses", async () => {
    await expect(assertAllowedOutboundUrl("https://mcp.example.com/mcp")).resolves.toBeUndefined()
    expect(lookupMock).toHaveBeenCalledWith("mcp.example.com", { all: true })
  })

  it.each([
    "javascript:alert(1)//",
    "data:text/html,<script>evil()</script>",
    "ftp://mcp.example.com/",
    "http://mcp.example.com/mcp",
    "not a url",
  ])("rejects %s by scheme without resolving DNS", async (candidate) => {
    await expect(assertAllowedOutboundUrl(candidate)).rejects.toBeInstanceOf(
      DisallowedOutboundUrlError,
    )
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it.each([
    "https://127.0.0.1/",
    "https://10.1.2.3/",
    "https://172.20.0.1/",
    "https://192.168.0.10/",
    "https://169.254.169.254/latest/meta-data/",
    "https://0.0.0.0/",
    "https://[::1]/",
    "https://[fe80::1]/",
    "https://[fd00::1]/",
    "https://[::ffff:127.0.0.1]/",
  ])("rejects the literal private host in %s without resolving DNS", async (candidate) => {
    await expect(assertAllowedOutboundUrl(candidate)).rejects.toBeInstanceOf(
      DisallowedOutboundUrlError,
    )
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it("accepts a literal public IP host", async () => {
    await expect(assertAllowedOutboundUrl("https://93.184.216.34/")).resolves.toBeUndefined()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it("rejects a hostname that resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }])
    await expect(assertAllowedOutboundUrl("https://internal.example.com/")).rejects.toThrow(
      /private or local/,
    )
  })

  it("rejects a hostname when any one of its addresses is private", async () => {
    lookupMock.mockResolvedValue([PUBLIC_V4, { address: "::ffff:169.254.169.254", family: 6 }])
    await expect(assertAllowedOutboundUrl("https://mixed.example.com/")).rejects.toThrow(
      /private or local/,
    )
  })

  it("rejects a hostname that does not resolve", async () => {
    lookupMock.mockRejectedValue(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }))
    await expect(assertAllowedOutboundUrl("https://missing.example.com/")).rejects.toThrow(
      /could not be resolved/,
    )
  })

  it("rejects https://localhost without the insecure-local flag", async () => {
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }])
    await expect(assertAllowedOutboundUrl("https://localhost:4000/")).rejects.toBeInstanceOf(
      DisallowedOutboundUrlError,
    )
  })

  describe("with MCP_OAUTH_ALLOW_INSECURE_LOCAL=true", () => {
    beforeEach(() => {
      process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL = "true"
    })

    it.each([
      "http://localhost:4000/",
      "http://127.0.0.1:4000/",
      "http://[::1]:4000/",
    ])("accepts %s", async (candidate) => {
      await expect(assertAllowedOutboundUrl(candidate)).resolves.toBeUndefined()
      expect(lookupMock).not.toHaveBeenCalled()
    })

    it("still rejects http for any other host", async () => {
      await expect(assertAllowedOutboundUrl("http://mcp.example.com/")).rejects.toBeInstanceOf(
        DisallowedOutboundUrlError,
      )
    })

    it("still rejects private addresses other than loopback", async () => {
      await expect(assertAllowedOutboundUrl("https://10.0.0.5/")).rejects.toBeInstanceOf(
        DisallowedOutboundUrlError,
      )
      await expect(assertAllowedOutboundUrl("http://169.254.169.254/")).rejects.toBeInstanceOf(
        DisallowedOutboundUrlError,
      )
    })

    it("still rejects non-http schemes on localhost", async () => {
      await expect(assertAllowedOutboundUrl("javascript://localhost/")).rejects.toBeInstanceOf(
        DisallowedOutboundUrlError,
      )
    })
  })
})

describe("isAllowedOutboundUrl", () => {
  beforeEach(() => {
    lookupMock.mockReset()
    lookupMock.mockResolvedValue([PUBLIC_V4])
  })

  it("returns true for an allowed URL and false for a disallowed one", async () => {
    expect(await isAllowedOutboundUrl("https://auth.example.com/authorize")).toBe(true)
    expect(await isAllowedOutboundUrl("https://192.168.0.1/authorize")).toBe(false)
    expect(await isAllowedOutboundUrl("javascript:alert(1)//")).toBe(false)
  })
})

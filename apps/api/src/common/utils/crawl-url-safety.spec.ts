import dns from "node:dns"
import { assertCrawlUrlIsSafe, assertIpIsSafe, UnsafeCrawlUrlError } from "./crawl-url-safety"

jest.mock("node:dns", () => ({ promises: { lookup: jest.fn() } }))

describe("assertIpIsSafe", () => {
  it("accepts a public IP", () => {
    expect(() => assertIpIsSafe("93.184.216.34")).not.toThrow()
  })

  it.each([
    ["loopback", "127.0.0.1"],
    ["private (RFC1918)", "10.0.0.1"],
    ["private (RFC1918)", "172.16.0.1"],
    ["private (RFC1918)", "192.168.1.1"],
    ["link-local / cloud metadata", "169.254.169.254"],
    ["IPv6 loopback", "::1"],
    ["IPv6 unique local", "fc00::1"],
    ["IPv4-mapped IPv6 private address", "::ffff:10.0.0.1"],
  ])("rejects %s address %s", (_label, address) => {
    expect(() => assertIpIsSafe(address)).toThrow(UnsafeCrawlUrlError)
  })
})

describe("assertCrawlUrlIsSafe", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("rejects non-http(s) protocols", async () => {
    await expect(assertCrawlUrlIsSafe("file:///etc/passwd")).rejects.toThrow(UnsafeCrawlUrlError)
    expect(dns.promises.lookup).not.toHaveBeenCalled()
  })

  it("accepts a hostname resolving to a public address", async () => {
    ;(dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }])

    await expect(assertCrawlUrlIsSafe("https://example.com/")).resolves.toBeUndefined()
  })

  it("rejects a hostname resolving to a private address", async () => {
    ;(dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: "10.0.0.5", family: 4 }])

    await expect(assertCrawlUrlIsSafe("https://internal.example.com/")).rejects.toThrow(
      UnsafeCrawlUrlError,
    )
  })

  it("rejects when any resolved address is private", async () => {
    ;(dns.promises.lookup as jest.Mock).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ])

    await expect(assertCrawlUrlIsSafe("https://example.com/")).rejects.toThrow(UnsafeCrawlUrlError)
  })

  it("rejects when DNS resolution fails", async () => {
    ;(dns.promises.lookup as jest.Mock).mockRejectedValue(new Error("ENOTFOUND"))

    await expect(assertCrawlUrlIsSafe("https://does-not-exist.invalid/")).rejects.toThrow(
      UnsafeCrawlUrlError,
    )
  })
})

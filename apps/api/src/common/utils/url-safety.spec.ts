import dns from "node:dns"
import { assertIpIsSafe, assertUrlIsSafe, UnsafeUrlError } from "./url-safety"

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
    expect(() => assertIpIsSafe(address)).toThrow(UnsafeUrlError)
  })
})

describe("assertUrlIsSafe", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("rejects non-http(s) protocols", async () => {
    await expect(assertUrlIsSafe("file:///etc/passwd")).rejects.toThrow(UnsafeUrlError)
    expect(dns.promises.lookup).not.toHaveBeenCalled()
  })

  it("accepts a hostname resolving to a public address", async () => {
    ;(dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }])

    await expect(assertUrlIsSafe("https://example.com/")).resolves.toBeUndefined()
  })

  it("rejects a hostname resolving to a private address", async () => {
    ;(dns.promises.lookup as jest.Mock).mockResolvedValue([{ address: "10.0.0.5", family: 4 }])

    await expect(assertUrlIsSafe("https://internal.example.com/")).rejects.toThrow(UnsafeUrlError)
  })

  it("rejects when any resolved address is private", async () => {
    ;(dns.promises.lookup as jest.Mock).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ])

    await expect(assertUrlIsSafe("https://example.com/")).rejects.toThrow(UnsafeUrlError)
  })

  it("rejects when DNS resolution fails", async () => {
    ;(dns.promises.lookup as jest.Mock).mockRejectedValue(new Error("ENOTFOUND"))

    await expect(assertUrlIsSafe("https://does-not-exist.invalid/")).rejects.toThrow(UnsafeUrlError)
  })
})

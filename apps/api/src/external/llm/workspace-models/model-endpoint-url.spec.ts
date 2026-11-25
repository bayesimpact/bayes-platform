import {
  assertSafeModelEndpointUrl,
  InvalidModelEndpointUrlError,
  isPrivateAddress,
} from "./model-endpoint-url"

const resolveTo =
  (...addresses: string[]) =>
  async () =>
    addresses

describe("assertSafeModelEndpointUrl", () => {
  it("accepts an https URL whose host resolves to public addresses", async () => {
    await expect(
      assertSafeModelEndpointUrl("https://vllm.example.org/base/", {
        allowPrivate: false,
        resolveHost: resolveTo("203.0.113.10", "2001:db8::1"),
      }),
    ).resolves.toBe("https://vllm.example.org/base/")
  })

  it.each([
    ["not a url", "not valid"],
    ["http://vllm.example.org/", "https"],
    ["ftp://vllm.example.org/", "https"],
    ["https://user:secret@vllm.example.org/", "credentials"],
  ])("refuses %s", async (url, message) => {
    await expect(
      assertSafeModelEndpointUrl(url, {
        allowPrivate: false,
        resolveHost: resolveTo("203.0.113.10"),
      }),
    ).rejects.toThrow(message)
  })

  it("refuses a host that resolves to one private address among public ones", async () => {
    await expect(
      assertSafeModelEndpointUrl("https://vllm.example.org/", {
        allowPrivate: false,
        resolveHost: resolveTo("203.0.113.10", "10.1.2.3"),
      }),
    ).rejects.toBeInstanceOf(InvalidModelEndpointUrlError)
  })

  it("refuses a host that does not resolve", async () => {
    await expect(
      assertSafeModelEndpointUrl("https://nowhere.example.org/", {
        allowPrivate: false,
        resolveHost: async () => {
          throw new Error("ENOTFOUND")
        },
      }),
    ).rejects.toThrow("cannot be resolved")
  })

  it("accepts http and private hosts when private servers are allowed", async () => {
    await expect(
      assertSafeModelEndpointUrl("http://localhost:8000/", {
        allowPrivate: true,
        resolveHost: resolveTo("127.0.0.1"),
      }),
    ).resolves.toBe("http://localhost:8000/")
  })
})

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.20.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:10.0.0.1",
    "not-an-ip",
  ])("treats %s as private", (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each([
    "203.0.113.10",
    "8.8.8.8",
    "2001:db8::1",
    "::ffff:8.8.8.8",
  ])("treats %s as public", (address) => {
    expect(isPrivateAddress(address)).toBe(false)
  })
})

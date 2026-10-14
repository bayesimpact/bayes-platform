import {
  ClientMetadataDocumentError,
  ClientMetadataDocumentFetcher,
  isBlockedAddress,
  parseClientMetadataDocumentUrl,
} from "./client-metadata-document.fetcher"

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "not-an-address",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true)
  })

  it.each([
    "93.184.216.34",
    "8.8.8.8",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("allows the public address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false)
  })
})

describe("parseClientMetadataDocumentUrl", () => {
  it("accepts an https URL with a path on the default port", () => {
    expect(parseClientMetadataDocumentUrl("https://client.example.org/client.json")?.host).toBe(
      "client.example.org",
    )
  })

  it.each([
    "http://client.example.org/client.json",
    "https://client.example.org/",
    "https://client.example.org:8443/client.json",
    "https://user:secret@client.example.org/client.json",
    "https://client.example.org/client.json#fragment",
    "https://10.0.0.1/client.json",
    "https://[::1]/client.json",
    "dcr_abc",
  ])("refuses %s", (clientId) => {
    expect(parseClientMetadataDocumentUrl(clientId)).toBeNull()
  })
})

describe("ClientMetadataDocumentFetcher", () => {
  const fetcher = new ClientMetadataDocumentFetcher()

  afterAll(() => fetcher.onModuleDestroy())

  it("never connects to a name that resolves to a loopback address", async () => {
    await expect(fetcher.fetchDocument(new URL("https://localhost/client.json"))).rejects.toThrow(
      ClientMetadataDocumentError,
    )
  })
})

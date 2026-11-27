import {
  ClientMetadataDocumentError,
  ClientMetadataDocumentFetcher,
  parseClientMetadataDocumentUrl,
} from "./client-metadata-document.fetcher"

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

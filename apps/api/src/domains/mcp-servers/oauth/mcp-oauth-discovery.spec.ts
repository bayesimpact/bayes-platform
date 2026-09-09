import { lookup } from "node:dns/promises"
import { discoverOauthConfiguration, registerOauthClient } from "./mcp-oauth-discovery"
import { DisallowedOutboundUrlError } from "./outbound-url-guard"

global.fetch = jest.fn()
const fetchMock = global.fetch as jest.Mock

// The outbound URL guard resolves every host before fetching; resolve the
// example.com fixtures to a public address so discovery reaches the fetch mock.
jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }))
const lookupMock = lookup as jest.Mock
const PUBLIC_ADDRESS = { address: "93.184.216.34", family: 4 }

const MCP_URL = "https://mcp.example.com/mcp"

const resourceMetadata = {
  resource: "https://mcp.example.com",
  authorization_servers: ["https://auth.example.com"],
  scopes_supported: ["mcp.tools", "offline_access"],
}

const authServerMetadata = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/oauth2/authorize",
  token_endpoint: "https://auth.example.com/oauth2/token",
  registration_endpoint: "https://auth.example.com/connect/register",
  code_challenge_methods_supported: ["S256"],
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

describe("discoverOauthConfiguration", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    lookupMock.mockReset()
    lookupMock.mockResolvedValue([PUBLIC_ADDRESS])
    delete process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL
  })

  afterAll(() => {
    delete process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL
  })

  it("follows WWW-Authenticate resource_metadata from a 401 probe", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 401,
          headers: {
            "WWW-Authenticate":
              'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"',
          },
        }),
      )
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery).toEqual({
      authorizationEndpoint: "https://auth.example.com/oauth2/authorize",
      tokenEndpoint: "https://auth.example.com/oauth2/token",
      registrationEndpoint: "https://auth.example.com/connect/register",
      resource: "https://mcp.example.com",
      scopesSupported: ["mcp.tools", "offline_access"],
    })
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    )
  })

  it("falls back to the path-derived well-known URL when the probe has no WWW-Authenticate", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.tokenEndpoint).toBe("https://auth.example.com/oauth2/token")
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    )
  })

  it("returns null when the server advertises no OAuth metadata", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    expect(await discoverOauthConfiguration(MCP_URL)).toBeNull()
  })

  it("tries openid-configuration when oauth-authorization-server metadata is missing", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.authorizationEndpoint).toBe("https://auth.example.com/oauth2/authorize")
    expect(fetchMock.mock.calls[3][0]).toBe(
      "https://auth.example.com/.well-known/openid-configuration",
    )
  })

  it("tries the RFC 8414 path-insertion metadata URL first for an issuer with a path", async () => {
    const pathIssuerMetadata = {
      ...resourceMetadata,
      authorization_servers: ["https://auth.example.com/tenant-a"],
    }
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(pathIssuerMetadata))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.authorizationEndpoint).toBe("https://auth.example.com/oauth2/authorize")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://auth.example.com/.well-known/oauth-authorization-server/tenant-a",
    )
  })

  it("falls back through the MCP spec discovery order for an issuer with a path", async () => {
    const pathIssuerMetadata = {
      ...resourceMetadata,
      authorization_servers: ["https://auth.example.com/tenant-a/"],
    }
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(pathIssuerMetadata))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.tokenEndpoint).toBe("https://auth.example.com/oauth2/token")
    const metadataUrls = fetchMock.mock.calls.slice(2).map(([url]) => url)
    expect(metadataUrls).toEqual([
      "https://auth.example.com/.well-known/oauth-authorization-server/tenant-a",
      "https://auth.example.com/.well-known/openid-configuration/tenant-a",
      "https://auth.example.com/tenant-a/.well-known/oauth-authorization-server",
      "https://auth.example.com/tenant-a/.well-known/openid-configuration",
    ])
  })

  it("accepts an http localhost authorization_endpoint with MCP_OAUTH_ALLOW_INSECURE_LOCAL", async () => {
    process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL = "true"
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(
        json({
          ...authServerMetadata,
          authorization_endpoint: "http://localhost:4000/oauth2/authorize",
          token_endpoint: "http://localhost:4000/oauth2/token",
        }),
      )

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.authorizationEndpoint).toBe("http://localhost:4000/oauth2/authorize")
    expect(discovery?.tokenEndpoint).toBe("http://localhost:4000/oauth2/token")
  })

  it("returns null for an http localhost authorization_endpoint without the insecure-local flag", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(
        json({
          ...authServerMetadata,
          authorization_endpoint: "http://localhost:4000/oauth2/authorize",
          token_endpoint: "http://localhost:4000/oauth2/token",
        }),
      )

    expect(await discoverOauthConfiguration(MCP_URL)).toBeNull()
  })

  it("returns null when authorization_endpoint is a javascript: URL", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(
        json({
          ...authServerMetadata,
          authorization_endpoint: "javascript:alert(document.domain)//",
        }),
      )

    expect(await discoverOauthConfiguration(MCP_URL)).toBeNull()
  })

  it("returns null when token_endpoint is a data: URL", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(
        json({ ...authServerMetadata, token_endpoint: "data:text/html,<script>evil()</script>" }),
      )

    expect(await discoverOauthConfiguration(MCP_URL)).toBeNull()
  })

  it("omits registration_endpoint when it is an unsafe URL but keeps the rest of discovery", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(
        json({ ...authServerMetadata, registration_endpoint: "javascript:alert(1)//" }),
      )

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.authorizationEndpoint).toBe("https://auth.example.com/oauth2/authorize")
    expect(discovery?.registrationEndpoint).toBeUndefined()
  })

  it("falls back to the path-derived well-known URL when resource_metadata is cross-origin", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 401,
          headers: {
            "WWW-Authenticate":
              'Bearer resource_metadata="https://attacker.example.com/.well-known/oauth-protected-resource"',
          },
        }),
      )
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.tokenEndpoint).toBe("https://auth.example.com/oauth2/token")
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    )
  })

  it("rejects a private-host MCP URL before making any request", async () => {
    await expect(
      discoverOauthConfiguration("https://169.254.169.254/latest/meta-data/"),
    ).rejects.toBeInstanceOf(DisallowedOutboundUrlError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects an MCP URL whose hostname resolves to a private address before making any request", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }])

    await expect(discoverOauthConfiguration(MCP_URL)).rejects.toBeInstanceOf(
      DisallowedOutboundUrlError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects a plain http MCP URL", async () => {
    await expect(discoverOauthConfiguration("http://mcp.example.com/mcp")).rejects.toBeInstanceOf(
      DisallowedOutboundUrlError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns null without fetching authorization server metadata when the issuer is a private host", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        json({ ...resourceMetadata, authorization_servers: ["https://10.0.0.5"] }),
      )

    expect(await discoverOauthConfiguration(MCP_URL)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("returns null without fetching authorization server metadata when the issuer resolves to a private address", async () => {
    lookupMock.mockImplementation(async (hostname: string) =>
      hostname === "auth.example.com" ? [{ address: "192.168.1.20", family: 4 }] : [PUBLIC_ADDRESS],
    )
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))

    expect(await discoverOauthConfiguration(MCP_URL)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("returns null when token_endpoint points at a private host", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(
        json({ ...authServerMetadata, token_endpoint: "https://127.0.0.1/oauth2/token" }),
      )

    expect(await discoverOauthConfiguration(MCP_URL)).toBeNull()
  })
})

describe("registerOauthClient", () => {
  beforeEach(() => fetchMock.mockReset())

  it("registers a public client and returns its client_id", async () => {
    fetchMock.mockResolvedValueOnce(json({ client_id: "client-123" }))

    const clientId = await registerOauthClient({
      registrationEndpoint: "https://auth.example.com/connect/register",
      redirectUri: "https://app.example.com/oauth/mcp/callback",
    })

    expect(clientId).toBe("client-123")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://auth.example.com/connect/register")
    expect(JSON.parse(init.body)).toMatchObject({
      redirect_uris: ["https://app.example.com/oauth/mcp/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    })
  })

  it("throws when registration fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 400 }))

    await expect(
      registerOauthClient({
        registrationEndpoint: "https://auth.example.com/connect/register",
        redirectUri: "https://app.example.com/oauth/mcp/callback",
      }),
    ).rejects.toThrow()
  })
})

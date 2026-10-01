import { OidcDiscoveryService } from "./oidc-discovery.service"
import { normalizeOidcName, OidcUserInfoService } from "./oidc-userinfo.service"

const ISSUER_URL = "https://idp.example.com/realms/acme"
const DISCOVERY_URL = `${ISSUER_URL}/.well-known/openid-configuration`
const USERINFO_URL = `${ISSUER_URL}/protocol/openid-connect/userinfo`

function mockFetchResponse(response: { ok?: boolean; status?: number; payload?: unknown }) {
  return {
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.payload,
    text: async () => (typeof response.payload === "string" ? response.payload : ""),
  }
}

describe("OidcUserInfoService", () => {
  const originalIssuerUrl = process.env.OIDC_ISSUER_URL
  let fetchMock: jest.Mock
  let service: OidcUserInfoService

  beforeEach(() => {
    process.env.OIDC_ISSUER_URL = `${ISSUER_URL}/`
    fetchMock = jest.fn()
    global.fetch = fetchMock
    service = new OidcUserInfoService(new OidcDiscoveryService())
  })

  afterEach(() => {
    process.env.OIDC_ISSUER_URL = originalIssuerUrl
    jest.restoreAllMocks()
  })

  const mockDiscovery = () =>
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        payload: {
          issuer: `${ISSUER_URL}/`,
          jwks_uri: `${ISSUER_URL}/protocol/openid-connect/certs`,
          userinfo_endpoint: USERINFO_URL,
        },
      }),
    )

  it("calls the userinfo endpoint found in the discovery document", async () => {
    const userInfo = { sub: "user-1", email: "person@example.com", email_verified: true }
    mockDiscovery()
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: userInfo }))

    const result = await service.getUserInfo("access-token")

    expect(fetchMock).toHaveBeenNthCalledWith(1, DISCOVERY_URL, expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, USERINFO_URL, {
      method: "GET",
      headers: { Authorization: "Bearer access-token", Accept: "application/json" },
    })
    expect(result).toEqual(userInfo)
  })

  it("fetches the discovery document only once", async () => {
    mockDiscovery()
    fetchMock.mockResolvedValue(mockFetchResponse({ payload: { sub: "user-1" } }))

    await service.getUserInfo("first-token")
    await service.getUserInfo("second-token")

    const discoveryCalls = fetchMock.mock.calls.filter(([url]) => url === DISCOVERY_URL)
    expect(discoveryCalls).toHaveLength(1)
  })

  it("retries the discovery document after a failure", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ ok: false, status: 503 }))
    await expect(service.getUserInfo("access-token")).rejects.toThrow(
      "Failed to fetch the OIDC discovery document",
    )

    mockDiscovery()
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { sub: "user-1" } }))
    await expect(service.getUserInfo("access-token")).resolves.toEqual({ sub: "user-1" })
  })

  it("throws when OIDC_ISSUER_URL is not configured", async () => {
    delete process.env.OIDC_ISSUER_URL

    await expect(service.getUserInfo("access-token")).rejects.toThrow(
      "OIDC_ISSUER_URL is not configured",
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws when the userinfo endpoint returns an error status", async () => {
    mockDiscovery()
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({ ok: false, status: 401, payload: "expired" }),
    )

    await expect(service.getUserInfo("access-token")).rejects.toThrow(
      "Failed to fetch OIDC user info: 401 expired",
    )
  })
})

describe("normalizeOidcName", () => {
  it("keeps the local part when the name is the email", () => {
    expect(normalizeOidcName("person@example.com", "person@example.com")).toBe("person")
  })

  it("keeps a real name as is", () => {
    expect(normalizeOidcName("Alex Martin", "person@example.com")).toBe("Alex Martin")
  })

  it("returns the name when the email is missing", () => {
    expect(normalizeOidcName("Alex Martin", undefined)).toBe("Alex Martin")
  })
})

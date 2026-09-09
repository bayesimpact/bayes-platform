import { GoogleAuth } from "google-auth-library"
import { GoogleIdTokenService } from "./google-id-token.service"

const getRequestHeaders = jest.fn()
const getIdTokenClient = jest.fn()

jest.mock("google-auth-library", () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: (...args: unknown[]) => getIdTokenClient(...args),
  })),
}))

describe("GoogleIdTokenService", () => {
  beforeEach(() => {
    jest.mocked(GoogleAuth).mockClear()
    getRequestHeaders.mockReset()
    getRequestHeaders.mockResolvedValue(new Headers({ authorization: "Bearer id-token" }))
    getIdTokenClient.mockReset()
    getIdTokenClient.mockImplementation(async () => ({ getRequestHeaders }))
  })

  it("should return the authorization header minted for the audience", async () => {
    const service = new GoogleIdTokenService()

    const header = await service.getAuthorizationHeader("https://service.example.test")

    expect(header).toBe("Bearer id-token")
    expect(getIdTokenClient).toHaveBeenCalledWith("https://service.example.test")
  })

  it("should build one client per audience and reuse it across calls", async () => {
    const service = new GoogleIdTokenService()

    await service.getAuthorizationHeader("https://first.example.test")
    await service.getAuthorizationHeader("https://first.example.test")
    await service.getAuthorizationHeader("https://second.example.test")

    expect(getIdTokenClient).toHaveBeenCalledTimes(2)
    expect(getIdTokenClient).toHaveBeenNthCalledWith(1, "https://first.example.test")
    expect(getIdTokenClient).toHaveBeenNthCalledWith(2, "https://second.example.test")
    expect(GoogleAuth).toHaveBeenCalledTimes(1)
  })

  it("should throw when the client returns no authorization header", async () => {
    getRequestHeaders.mockResolvedValue(new Headers())
    const service = new GoogleIdTokenService()

    await expect(service.getAuthorizationHeader("https://service.example.test")).rejects.toThrow(
      "could not obtain a Google ID token for audience https://service.example.test",
    )
  })
})

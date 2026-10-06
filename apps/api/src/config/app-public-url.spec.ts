import { getAppPublicUrl } from "./app-public-url"

describe("getAppPublicUrl", () => {
  it("prefers APP_PUBLIC_URL", () => {
    expect(
      getAppPublicUrl({
        APP_PUBLIC_URL: "https://platform.example.org/app/",
        FRONTEND_URL: "https://other.example.org",
      }),
    ).toBe("https://platform.example.org/app")
  })

  it("falls back to the first FRONTEND_URL entry", () => {
    expect(
      getAppPublicUrl({ FRONTEND_URL: "https://platform.example.org, https://embed.example.org" }),
    ).toBe("https://platform.example.org")
  })

  it("returns null when neither is set", () => {
    expect(getAppPublicUrl({})).toBeNull()
  })
})

import { parseInstallArgs } from "./args"

describe("parseInstallArgs", () => {
  it("reads the slug and the frontend origin flag", () => {
    expect(
      parseInstallArgs(
        ["apps", "install", "sitecrawler", "--frontend", "https://connect.localhost:5173"],
        {},
      ),
    ).toEqual({
      kind: "install",
      slug: "sitecrawler",
      frontendOrigin: "https://connect.localhost:5173",
    })
  })

  it("uses BAYES_FRONTEND_URL when the flag is absent", () => {
    expect(
      parseInstallArgs(["apps", "install", "sitecrawler"], {
        BAYES_FRONTEND_URL: "https://connect.example",
      }),
    ).toEqual({
      kind: "install",
      slug: "sitecrawler",
      frontendOrigin: "https://connect.example",
    })
  })

  it("asks for a frontend origin when none is set", () => {
    const parsed = parseInstallArgs(["apps", "install", "sitecrawler"], {})
    expect(parsed.kind).toBe("error")
  })

  it("shows help for bayes with no command", () => {
    expect(parseInstallArgs([], {}).kind).toBe("help")
    expect(parseInstallArgs(["apps", "install", "--help"], {}).kind).toBe("help")
  })
})

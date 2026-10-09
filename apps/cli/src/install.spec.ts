import { parseLoopbackRedirectUri } from "@caseai-connect/api-contracts"
import { parseFrontendOrigin, runAppsInstall } from "./install"

const frontendOrigin = "https://connect.localhost:5173"
const apiOrigin = "https://connect.localhost:5173/api"

const exchangeInstallCode = async () => ({
  clientId: "client-1",
  clientSecret: "secret-1",
})

describe("runAppsInstall", () => {
  it("opens a loopback install URL and prints the credentials once", async () => {
    const lines: string[] = []
    let page = Promise.resolve("")
    const exitCode = await runAppsInstall({
      slug: "sitecrawler",
      frontendOrigin,
      apiOrigin,
      state: "session-state",
      timeoutMs: 2_000,
      exchangeInstallCode,
      write: (text) => lines.push(text),
      writeError: (text) => lines.push(text),
      openUrl: (url) => {
        const installUrl = new URL(url)
        const redirectUri = installUrl.searchParams.get("redirect_uri") ?? ""
        parseLoopbackRedirectUri(redirectUri)
        const callback = new URL(redirectUri)
        callback.searchParams.set("code", "install-code-1")
        callback.searchParams.set("state", installUrl.searchParams.get("state") ?? "")
        page = fetch(callback).then((response) => response.text())
      },
    })

    expect(exitCode).toBe(0)
    expect(lines[0]).toContain("Approve sitecrawler")
    expect(lines[0]).toContain("/apps/install/sitecrawler?")
    expect(lines[0]).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A")
    expect(lines[0]).toContain("state=session-state")
    expect(lines[0]).toContain("code_challenge=")
    expect(lines[0]).toContain("code_challenge_method=S256")
    const printed = lines.join("")
    expect(printed).toContain("sitecrawler is installed")
    expect(printed).toContain("Client id")
    expect(printed).toContain("client-1")
    expect(printed).toContain("Client secret")
    expect(printed).toContain("secret-1")
    expect(printed).toContain("cannot be retrieved later")
    const html = await page
    expect(html).toContain("sitecrawler is installed")
    expect(html).toContain("in your terminal")
    expect(html).not.toContain("secret-1")
  })

  it("colors the client secret when color is enabled", async () => {
    const lines: string[] = []
    const exitCode = await runAppsInstall({
      slug: "sitecrawler",
      frontendOrigin,
      apiOrigin,
      state: "session-state",
      timeoutMs: 2_000,
      color: true,
      exchangeInstallCode,
      write: (text) => lines.push(text),
      writeError: (text) => lines.push(text),
      openUrl: (url) => {
        const installUrl = new URL(url)
        const callback = new URL(installUrl.searchParams.get("redirect_uri") ?? "")
        callback.searchParams.set("code", "install-code-1")
        callback.searchParams.set("state", "session-state")
        void fetch(callback)
      },
    })

    expect(exitCode).toBe(0)
    const printed = lines.join("")
    expect(printed).toContain("\u001b[1;35mApprove sitecrawler in your browser.\u001b[0m")
    expect(printed).toContain("\u001b[1;32msitecrawler is installed.\u001b[0m")
    expect(printed).toContain("\u001b[36mclient-1\u001b[0m")
    expect(printed).toContain("\u001b[1;36msecret-1\u001b[0m")
    expect(printed).toContain("\u001b[33mSave the client secret now.")
  })

  it("rejects a mismatched state and does not print the secret", async () => {
    const output: string[] = []
    const errors: string[] = []
    const exitCode = await runAppsInstall({
      slug: "sitecrawler",
      frontendOrigin,
      apiOrigin,
      state: "expected-state",
      timeoutMs: 2_000,
      exchangeInstallCode,
      write: (text) => output.push(text),
      writeError: (text) => errors.push(text),
      openUrl: (url) => {
        const installUrl = new URL(url)
        const callback = new URL(installUrl.searchParams.get("redirect_uri") ?? "")
        callback.searchParams.set("code", "install-code-1")
        callback.searchParams.set("state", "expected-other")
        void fetch(callback)
      },
    })

    expect(exitCode).toBe(1)
    expect(output.join("")).not.toContain("secret-1")
    expect(errors.join("")).toContain("state did not match")
  })

  it("reports a cancelled authorization", async () => {
    const errors: string[] = []
    const exitCode = await runAppsInstall({
      slug: "sitecrawler",
      frontendOrigin,
      apiOrigin,
      state: "session-state",
      timeoutMs: 2_000,
      write: () => undefined,
      writeError: (text) => errors.push(text),
      openUrl: (url) => {
        const installUrl = new URL(url)
        const callback = new URL(installUrl.searchParams.get("redirect_uri") ?? "")
        callback.searchParams.set("error", "access_denied")
        callback.searchParams.set("state", "session-state")
        void fetch(callback)
      },
    })

    expect(exitCode).toBe(1)
    expect(errors.join("")).toContain("cancelled")
  })

  it("rejects a callback without a code", async () => {
    const errors: string[] = []
    const exitCode = await runAppsInstall({
      slug: "sitecrawler",
      frontendOrigin,
      apiOrigin,
      state: "session-state",
      timeoutMs: 2_000,
      write: () => undefined,
      writeError: (text) => errors.push(text),
      openUrl: (url) => {
        const installUrl = new URL(url)
        const callback = new URL(installUrl.searchParams.get("redirect_uri") ?? "")
        callback.searchParams.set("state", "session-state")
        void fetch(callback)
      },
    })

    expect(exitCode).toBe(1)
    expect(errors.join("")).toContain("authorization code")
  })

  it("parses a frontend origin", () => {
    expect(parseFrontendOrigin("https://connect.localhost:5173")).toBe(
      "https://connect.localhost:5173",
    )
    expect(parseFrontendOrigin("https://connect.localhost:5173/")).toBe(
      "https://connect.localhost:5173",
    )
  })
})

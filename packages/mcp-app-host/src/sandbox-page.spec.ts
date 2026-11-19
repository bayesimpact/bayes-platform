import { describe, expect, it } from "vitest"
import {
  inlineSandboxPage,
  MCP_APP_FRAME_SANDBOX,
  MCP_APP_ORIGIN_FRAME_SANDBOX,
  servedSandboxPage,
} from "./sandbox-page"

describe("the frames", () => {
  it("run the app with scripts and an opaque origin", () => {
    expect(MCP_APP_FRAME_SANDBOX.split(" ")).toContain("allow-scripts")
    expect(MCP_APP_FRAME_SANDBOX).not.toContain("allow-same-origin")
  })

  it("let the outer frame keep the origin that serves it, and nothing more", () => {
    expect(MCP_APP_ORIGIN_FRAME_SANDBOX).toBe(`${MCP_APP_FRAME_SANDBOX} allow-same-origin`)
  })
})

describe.each([
  ["the page a host writes", inlineSandboxPage("sandbox-1")],
  ["the page a sandbox origin serves", servedSandboxPage()],
])("%s", (_name, page) => {
  it("gives the app's frame an opaque origin of its own", () => {
    expect(page).toContain(`app.setAttribute("sandbox", "${MCP_APP_FRAME_SANDBOX}")`)
    expect(page).not.toContain("allow-same-origin")
  })

  it("answers the origin of its host, not every origin", () => {
    expect(page).toContain("message: event.data }, hostOrigin)")
  })

  it("carries no Content Security Policy, which every app would inherit", () => {
    expect(page).not.toContain("Content-Security-Policy")
  })
})

describe("the sandbox's id", () => {
  it("is written in the page a host writes", () => {
    expect(inlineSandboxPage('a"b')).toContain(`var sandboxId = ${JSON.stringify('a"b')};`)
  })

  it("is read in the URL of the page a sandbox origin serves, the same for every app", () => {
    expect(servedSandboxPage()).toContain("window.location.hash")
  })
})

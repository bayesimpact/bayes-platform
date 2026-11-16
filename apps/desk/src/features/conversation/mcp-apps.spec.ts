import { describe, expect, it } from "vitest"
import type { ChatMcpApp } from "./chat-messages"
import { findMcpAppHtml, hasMeaningfulText, unavailableApps, withAppMessage } from "./mcp-apps"

const app = (overrides: Partial<ChatMcpApp> = {}): ChatMcpApp => ({
  toolCallId: crypto.randomUUID(),
  mcpServerId: "server",
  resourceUri: "ui://card",
  toolInput: {},
  toolResult: { content: [{ type: "text", text: "Done." }] },
  ...overrides,
})

describe("findMcpAppHtml", () => {
  const htmls = [
    { mcpServerId: "other", resourceUri: "ui://card", html: "<p>other</p>" },
    { mcpServerId: "server", resourceUri: "ui://card", html: "<p>card</p>" },
  ]

  it("takes the HTML of the app's resource on its server", () => {
    expect(findMcpAppHtml(app(), htmls)?.html).toBe("<p>card</p>")
  })

  it("takes the first server's for a pointer saved before servers were named", () => {
    expect(findMcpAppHtml(app({ mcpServerId: null }), htmls)?.html).toBe("<p>other</p>")
  })

  it("keeps the domains the app declares, for its Content Security Policy", () => {
    const csp = { connectDomains: ["https://api.example.org"] }
    const declared = [{ mcpServerId: "server", resourceUri: "ui://card", html: "<p>card</p>", csp }]

    expect(findMcpAppHtml(app(), declared)?.csp).toEqual(csp)
    expect(findMcpAppHtml(app(), htmls)?.csp).toBeUndefined()
  })

  it("finds nothing for blank HTML or another resource", () => {
    expect(findMcpAppHtml(app({ resourceUri: "ui://else" }), htmls)).toBeNull()
    expect(
      findMcpAppHtml(app(), [{ mcpServerId: "server", resourceUri: "ui://card", html: " " }]),
    ).toBeNull()
  })
})

describe("the texts of replies and apps", () => {
  it("adds an app's message after what the person wrote, or fills an empty box with it", () => {
    expect(withAppMessage("Thanks, and also: \n", "I picked plan B")).toBe(
      "Thanks, and also:\n\nI picked plan B",
    )
    expect(withAppMessage("  ", "I picked plan B")).toBe("I picked plan B")
  })

  it("tells a reply's text from a bare punctuation mark", () => {
    expect(hasMeaningfulText(".")).toBe(false)
    expect(hasMeaningfulText("Voilà")).toBe(true)
  })
})

describe("unavailableApps", () => {
  it("counts the apps that failed and, once the HTML came, those without any", () => {
    const failed = app()
    const withoutHtml = app({ resourceUri: "ui://none" })
    const shown = app()
    const htmls = [{ mcpServerId: "server", resourceUri: "ui://card", html: "<p>card</p>" }]

    expect(
      unavailableApps([failed, withoutHtml, shown], { htmls, isPending: false }, [
        failed.toolCallId,
      ]),
    ).toEqual([failed, withoutHtml])
    expect(unavailableApps([withoutHtml], { htmls, isPending: true }, [])).toEqual([])
  })
})

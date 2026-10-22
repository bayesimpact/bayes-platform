import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js"
import { describe, expect, it } from "vitest"
import type { ChatMcpApp } from "./chat-messages"
import {
  appMessageText,
  findMcpAppHtml,
  hasMeaningfulText,
  toCallToolResult,
  toolResultText,
  unavailableApps,
} from "./mcp-apps"

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
    expect(findMcpAppHtml(app(), htmls)).toBe("<p>card</p>")
  })

  it("takes the first server's for a pointer saved before servers were named", () => {
    expect(findMcpAppHtml(app({ mcpServerId: null }), htmls)).toBe("<p>other</p>")
  })

  it("finds nothing for blank HTML or another resource", () => {
    expect(findMcpAppHtml(app({ resourceUri: "ui://else" }), htmls)).toBeNull()
    expect(
      findMcpAppHtml(app(), [{ mcpServerId: "server", resourceUri: "ui://card", html: " " }]),
    ).toBeNull()
  })
})

describe("the texts of tools and apps", () => {
  it("reads the text blocks of a tool result and of a message an app proposes", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: " First " },
      { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
      { type: "text", text: "Second" },
    ]
    expect(toolResultText({ content: blocks })).toBe("First\nSecond")
    expect(appMessageText(blocks)).toBe("First\n\nSecond")
    expect(toolResultText("not a result")).toBe("")
  })

  it("wraps a result without content as the structured content of an empty text", () => {
    expect(toCallToolResult({ releases: 3 })).toEqual({
      content: [{ type: "text", text: "" }],
      structuredContent: { releases: 3 },
    })
    expect(toCallToolResult(42).structuredContent).toEqual({ value: 42 })
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

describe("a tool result that breaks the MCP schema", () => {
  it("reaches the app as structured content, and shows no text", () => {
    const broken = { content: [{ type: "text", text: 42 }] }

    expect(toCallToolResult(broken)).toEqual({
      content: [{ type: "text", text: "" }],
      structuredContent: broken,
    })
    expect(toolResultText(broken)).toBe("")
  })
})

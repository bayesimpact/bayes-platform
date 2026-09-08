import type { AgentSessionToolCallDto } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import {
  findMcpAppHtml,
  getFailedMcpAppFallbackText,
  getMcpAppToolResultText,
  getRenderableMcpApp,
  getReplyBubbleText,
  hasMcpAppCard,
  hasMcpAppPointer,
  isOpenableLink,
} from "./mcp-app-view"

const baseToolCall: AgentSessionToolCallDto = {
  id: "call-1",
  name: "search_resources",
  arguments: { query: "hello" },
}

const pointer = { mcpServerId: "mcp-server-1", resourceUri: "ui://pdf-export/mcp-app.html" }
const cardToolCall: AgentSessionToolCallDto = {
  ...baseToolCall,
  name: "export_pdf",
  result: { content: [{ type: "text", text: "Exported" }] },
  mcpApp: pointer,
}

describe("hasMcpAppPointer", () => {
  it("is true when a reply points at a card, even before its HTML is loaded", () => {
    expect(hasMcpAppPointer([{ toolCalls: [cardToolCall] }])).toBe(true)
  })

  it("is false for a thread with only ordinary tool calls", () => {
    expect(hasMcpAppPointer([{ toolCalls: [baseToolCall] }, { toolCalls: undefined }])).toBe(false)
  })
})

describe("hasMcpAppCard", () => {
  it("needs both a pointer and a result to hand the card", () => {
    expect(hasMcpAppCard(cardToolCall)).toBe(true)
    expect(hasMcpAppCard({ ...cardToolCall, result: undefined })).toBe(false)
    expect(hasMcpAppCard(baseToolCall)).toBe(false)
  })
})

describe("findMcpAppHtml", () => {
  const entries = [{ ...pointer, html: "<html>live</html>" }]

  it("prefers the HTML embedded on the tool call", () => {
    expect(findMcpAppHtml({ ...pointer, html: "<html>inline</html>" }, entries)).toBe(
      "<html>inline</html>",
    )
  })

  it("resolves the pointer against the entry read from the same server", () => {
    expect(findMcpAppHtml(pointer, entries)).toBe("<html>live</html>")
    expect(findMcpAppHtml({ ...pointer, mcpServerId: "other-server" }, entries)).toBeUndefined()
  })

  it("accepts any server's entry for a pointer recorded without a server id", () => {
    expect(findMcpAppHtml({ ...pointer, mcpServerId: "" }, entries)).toBe("<html>live</html>")
  })

  it("is undefined while nothing has been loaded", () => {
    expect(findMcpAppHtml(pointer, [])).toBeUndefined()
  })
})

describe("getRenderableMcpApp", () => {
  it("returns nothing for a normal tool call without MCP App metadata", () => {
    expect(getRenderableMcpApp(baseToolCall)).toBeUndefined()
  })

  it("renders a card whose HTML arrived through the separate load", () => {
    expect(getRenderableMcpApp(cardToolCall, [{ ...pointer, html: "<html>live</html>" }])).toEqual({
      html: "<html>live</html>",
      toolInput: cardToolCall.arguments,
      toolResult: cardToolCall.result,
    })
    expect(getRenderableMcpApp(cardToolCall, [])).toBeUndefined()
  })

  it("returns view props when HTML and the tool result are present", () => {
    const result = { content: [{ type: "text", text: "ok" }], structuredContent: { title: "Ada" } }
    expect(
      getRenderableMcpApp({
        ...baseToolCall,
        name: "get_patient",
        result,
        mcpApp: {
          mcpServerId: "mcp-server-1",
          resourceUri: "ui://patient-summary/mcp-app.html",
          html: "<html><body>Patient</body></html>",
        },
      }),
    ).toEqual({
      html: "<html><body>Patient</body></html>",
      toolInput: { query: "hello" },
      toolResult: result,
    })
  })

  it("falls back when the MCP App payload is malformed", () => {
    expect(
      getRenderableMcpApp({
        ...baseToolCall,
        result: { structuredContent: { title: "Ada" } },
        mcpApp: {
          mcpServerId: "mcp-server-1",
          resourceUri: "ui://patient-summary/mcp-app.html",
          html: "   ",
        },
      }),
    ).toBeUndefined()
  })
})

describe("getReplyBubbleText", () => {
  const renderedCardToolCall: AgentSessionToolCallDto = {
    ...cardToolCall,
    id: "call-2",
    result: { content: [{ type: "text", text: "Created Notes.pdf (2 pages)." }] },
    mcpApp: { ...pointer, html: "<html><body>Card</body></html>" },
  }

  it("keeps the reply text next to a rendered card", () => {
    // The card shows the tool result, the text carries what the model said about it.
    expect(
      getReplyBubbleText("Done! Download it from the card below.", [renderedCardToolCall], []),
    ).toBe("Done! Download it from the card below.")
  })

  it("keeps the reply text when a card gave up rendering", () => {
    expect(getReplyBubbleText("Done!", [renderedCardToolCall], ["call-2"])).toBe("Done!")
  })

  it("says nothing when the model wrote nothing and the card is on screen", () => {
    expect(getReplyBubbleText("  ", [renderedCardToolCall], [])).toBe("")
  })

  it("lets the tool result text stand in when the model wrote nothing and the card gave up", () => {
    expect(getReplyBubbleText("", [renderedCardToolCall], ["call-2"])).toBe(
      "Created Notes.pdf (2 pages).",
    )
  })
})

describe("getMcpAppToolResultText", () => {
  it("joins the text parts of an MCP tool result", () => {
    expect(
      getMcpAppToolResultText({
        content: [
          { type: "text", text: "Created report.pdf (3 pages)." },
          { type: "image", data: "...", mimeType: "image/png" },
          { type: "text", text: "  Download: https://example.com/report.pdf  " },
        ],
        structuredContent: { fileName: "report.pdf" },
      }),
    ).toBe("Created report.pdf (3 pages).\nDownload: https://example.com/report.pdf")
  })

  it("is empty when the result has no text content", () => {
    expect(getMcpAppToolResultText(undefined)).toBe("")
    expect(getMcpAppToolResultText("plain string")).toBe("")
    expect(getMcpAppToolResultText({ structuredContent: { title: "Ada" } })).toBe("")
    expect(getMcpAppToolResultText({ content: "not a list" })).toBe("")
    expect(getMcpAppToolResultText({ content: [{ type: "text", text: "   " }] })).toBe("")
  })
})

describe("getFailedMcpAppFallbackText", () => {
  const cardToolCall: AgentSessionToolCallDto = {
    ...baseToolCall,
    id: "call-card",
    name: "export_pdf",
    result: { content: [{ type: "text", text: "Created report.pdf (3 pages)." }] },
    mcpApp: {
      mcpServerId: "mcp-server-1",
      resourceUri: "ui://pdf-export/mcp-app.html",
      html: "<html><body>Card</body></html>",
    },
  }

  it("is empty while no card has failed", () => {
    expect(getFailedMcpAppFallbackText([baseToolCall, cardToolCall], [])).toBe("")
    expect(getFailedMcpAppFallbackText(undefined, ["call-card"])).toBe("")
  })

  it("returns the tool result text of the cards that failed to render", () => {
    expect(getFailedMcpAppFallbackText([baseToolCall, cardToolCall], ["call-card"])).toBe(
      "Created report.pdf (3 pages).",
    )
  })

  it("separates the text of several failed cards and skips results without text", () => {
    const silentCard: AgentSessionToolCallDto = {
      ...cardToolCall,
      id: "call-silent",
      result: { structuredContent: { title: "Ada" } },
    }
    const secondCard: AgentSessionToolCallDto = {
      ...cardToolCall,
      id: "call-second",
      result: { content: [{ type: "text", text: "Created notes.pdf (1 page)." }] },
    }
    expect(
      getFailedMcpAppFallbackText(
        [cardToolCall, silentCard, secondCard],
        ["call-card", "call-silent", "call-second"],
      ),
    ).toBe("Created report.pdf (3 pages).\n\nCreated notes.pdf (1 page).")
  })
})

describe("isOpenableLink", () => {
  it("accepts https and http URLs", () => {
    expect(isOpenableLink("https://example.com/file.pdf")).toBe(true)
    expect(isOpenableLink("http://example.com/file.pdf")).toBe(true)
  })

  it("rejects javascript, data, blob and mailto URLs", () => {
    expect(isOpenableLink("javascript:alert(1)")).toBe(false)
    expect(isOpenableLink("data:text/html,<script>alert(1)</script>")).toBe(false)
    expect(isOpenableLink("blob:https://example.com/uuid")).toBe(false)
    expect(isOpenableLink("mailto:someone@example.com")).toBe(false)
  })

  it("rejects relative paths and unparsable strings", () => {
    expect(isOpenableLink("/relative/path")).toBe(false)
    expect(isOpenableLink("not a url")).toBe(false)
  })
})

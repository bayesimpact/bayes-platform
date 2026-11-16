import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js"
import { describe, expect, it } from "vitest"
import { appMessageText, toCallToolResult, toolResultText } from "./tool-result"

describe("the texts of tools and apps", () => {
  it("reads the text blocks of a tool result and of a message an app proposes", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: " First " },
      { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
      { type: "text", text: "Second" },
    ]
    expect(toolResultText({ content: blocks })).toBe("First\nSecond")
    expect(appMessageText(blocks)).toBe("First\n\nSecond")
  })

  it("finds no text where a result has none", () => {
    expect(toolResultText(undefined)).toBe("")
    expect(toolResultText("not a result")).toBe("")
    expect(toolResultText({ structuredContent: { title: "Report" } })).toBe("")
    expect(toolResultText({ content: "not a list" })).toBe("")
    expect(toolResultText({ content: [{ type: "text", text: "   " }] })).toBe("")
    expect(appMessageText([])).toBe("")
  })
})

describe("toCallToolResult", () => {
  it("keeps a raw MCP result as it is", () => {
    const result = {
      content: [{ type: "text", text: "Done." }],
      structuredContent: { releases: 3 },
    }
    expect(toCallToolResult(result)).toEqual(result)
  })

  it("wraps a result without content as the structured content of an empty text", () => {
    expect(toCallToolResult({ releases: 3 })).toEqual({
      content: [{ type: "text", text: "" }],
      structuredContent: { releases: 3 },
    })
    expect(toCallToolResult(42).structuredContent).toEqual({ value: 42 })
  })

  it("wraps a result that breaks the MCP schema, which then shows no text", () => {
    const broken = { content: [{ type: "text", text: 42 }] }

    expect(toCallToolResult(broken)).toEqual({
      content: [{ type: "text", text: "" }],
      structuredContent: broken,
    })
    expect(toolResultText(broken)).toBe("")
  })
})

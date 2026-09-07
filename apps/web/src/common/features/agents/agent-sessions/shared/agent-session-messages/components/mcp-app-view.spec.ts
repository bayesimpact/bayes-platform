import type { AgentSessionToolCallDto } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { getRenderableMcpApp, hasRenderableMcpApp, isOpenableLink } from "./mcp-app-view"

const baseToolCall: AgentSessionToolCallDto = {
  id: "call-1",
  name: "search_resources",
  arguments: { query: "hello" },
}

describe("getRenderableMcpApp", () => {
  it("returns nothing for a normal tool call without MCP App metadata", () => {
    expect(getRenderableMcpApp(baseToolCall)).toBeUndefined()
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

describe("hasRenderableMcpApp", () => {
  it("is false for ordinary tool calls", () => {
    expect(hasRenderableMcpApp([baseToolCall])).toBe(false)
  })

  it("is true when at least one tool call has MCP App HTML and a result", () => {
    expect(
      hasRenderableMcpApp([
        baseToolCall,
        {
          ...baseToolCall,
          id: "call-2",
          name: "get_patient",
          result: { structuredContent: { title: "Ada" } },
          mcpApp: {
            mcpServerId: "mcp-server-1",
            resourceUri: "ui://patient-summary/mcp-app.html",
            html: "<html><body>Patient</body></html>",
          },
        },
      ]),
    ).toBe(true)
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

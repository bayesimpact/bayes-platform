import { ToolName } from "@caseai-connect/api-contracts"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { inlineCitationInstruction } from "@/domains/agents/shared/agent-session-messages/streaming/tools/lookup-knowledge-base.tool"
import { applyMcpAppToolDescription } from "@/external/mcp/mcp-app-tool-description"
import { promptHelpers } from "./helpers"

const agentSettings = {} as AgentSettings

describe("promptHelpers.tools", () => {
  it("lists every declared tool with a description line", () => {
    const section = promptHelpers.tools({
      agentSettings,
      names: [ToolName.LookupKnowledgeBase, ToolName.SurfaceResources],
    })

    expect(section).toContain("## Tools:")
    expect(section).toContain(`[${ToolName.LookupKnowledgeBase}]:`)
    expect(section).toContain(`[${ToolName.SurfaceResources}]:`)
    // No bookkeeping protocol in the prompt any more (ADR 0016).
    expect(section).not.toContain("Response protocol")
    expect(section).not.toContain("mandatory")
  })

  it("appends the inline citation rule to the lookup line only when provided", () => {
    const withoutSources = promptHelpers.tools({
      agentSettings,
      names: [ToolName.LookupKnowledgeBase],
    })
    expect(withoutSources).not.toContain("Cite your sources inline")

    const withSources = promptHelpers.tools({
      agentSettings,
      names: [ToolName.LookupKnowledgeBase],
      descriptions: { [ToolName.LookupKnowledgeBase]: inlineCitationInstruction() },
    })
    expect(withSources).toContain(`[${ToolName.LookupKnowledgeBase}]:`)
    expect(withSources).toContain("Cite your sources inline")
    expect(withSources.match(/\[lookup_knowledge_base\]:/g) ?? []).toHaveLength(1)
  })

  it("explains that MCP App tools render a UI when called", () => {
    const section = promptHelpers.mcpAppUis({
      get_patient: applyMcpAppToolDescription("Get a patient."),
      search_resources: "Search resources.",
    })

    expect(section).toContain("## Interactive tool UIs")
    expect(section).toContain("get_patient")
    expect(section).toContain("Do not recap, summarize, or restate the UI contents in markdown")
    expect(section).not.toContain("search_resources")
  })

  it("omits the MCP App section when no tool has a UI resource", () => {
    expect(promptHelpers.mcpAppUis({ search_resources: "Search resources." })).toBe("")
  })
})

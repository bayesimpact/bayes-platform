import { TOOL_NAMES } from "@caseai-connect/chat-contracts"
import { describe, expect, it } from "vitest"
import { isFormTool } from "./form-tools"

describe("isFormTool", () => {
  it("is true for the tools that fill in or consolidate a form, and false for the others", () => {
    expect(isFormTool(TOOL_NAMES.fillForm)).toBe(true)
    expect(isFormTool(TOOL_NAMES.consolidateForm)).toBe(true)
    expect(isFormTool(TOOL_NAMES.saveMemory)).toBe(false)
    expect(isFormTool("a_tool_of_an_mcp_server")).toBe(false)
  })
})

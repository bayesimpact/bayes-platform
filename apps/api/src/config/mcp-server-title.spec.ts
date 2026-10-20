import { getMcpServerTitle } from "./mcp-server-title"

describe("getMcpServerTitle", () => {
  it("uses MCP_SERVER_TITLE", () => {
    expect(getMcpServerTitle({ MCP_SERVER_TITLE: " My platform " })).toBe("My platform")
  })

  it("falls back to a neutral title", () => {
    expect(getMcpServerTitle({})).toBe("Agent platform")
    expect(getMcpServerTitle({ MCP_SERVER_TITLE: "  " })).toBe("Agent platform")
  })
})

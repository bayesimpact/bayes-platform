import { TOOL_NAMES } from "@caseai-connect/desk-contracts"
import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { ToolSteps } from "./ToolSteps"

describe("ToolSteps", () => {
  it("names the platform's tools, and any other one as a generic step", () => {
    renderWithI18n(
      <ToolSteps
        toolNames={[TOOL_NAMES.saveMemory, "constructor", TOOL_NAMES.sources, "toString"]}
        isWriting
        hasText={false}
      />,
    )

    expect(screen.getByText("Remembering what matters")).toBeInTheDocument()
    // The names an object holds through its prototype are tools like any other.
    expect(screen.getAllByText("Using a tool")).toHaveLength(2)
    expect(screen.queryByText("sources")).not.toBeInTheDocument()
  })
})

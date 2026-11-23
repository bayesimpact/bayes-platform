import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { BulkRecordsDialog } from "./BulkRecordsDialog"

describe("BulkRecordsDialog", () => {
  it("names the lines that make no record, and adds nothing while one stays", async () => {
    const onSubmit = vi.fn()
    renderWithI18n(<BulkRecordsDialog isPending={false} onSubmit={onSubmit} onClose={() => {}} />)
    const lines = screen.getByRole("textbox", { name: "Records" })

    await userEvent.type(lines, "How do I invite a colleague?, From Settings.{enter}No answer")
    expect(screen.getByText("Line 2 has no input or no expected output.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add 1 record" })).toBeDisabled()

    await userEvent.type(lines, ", Yes, there is one.")
    await userEvent.click(screen.getByRole("button", { name: "Add 2 records" }))
    expect(onSubmit).toHaveBeenCalledWith([
      { input: "How do I invite a colleague?", expectedOutput: "From Settings." },
      { input: "No answer", expectedOutput: "Yes, there is one." },
    ])
  })
})

import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode, useState } from "react"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { SidePanel } from "./SidePanel"

function PanelOpener() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setIsOpen((current) => !current)}>
        Memory
      </button>
      {isOpen ? (
        <SidePanel title="What the agent remembers" onClose={() => setIsOpen(false)}>
          <button type="button">Forget</button>
        </SidePanel>
      ) : null}
    </>
  )
}

describe("SidePanel", () => {
  it("takes the focus on its title, closes on Escape, and gives the focus back", async () => {
    // StrictMode runs the panel's effect twice, as the app does in development.
    renderWithI18n(
      <StrictMode>
        <PanelOpener />
      </StrictMode>,
    )
    const opener = screen.getByRole("button", { name: "Memory" })

    await userEvent.click(opener)
    expect(screen.getByRole("heading", { name: "What the agent remembers" })).toHaveFocus()

    await userEvent.tab()
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})

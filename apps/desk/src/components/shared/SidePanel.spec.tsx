import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode, useState } from "react"
import { describe, expect, it, vi } from "vitest"
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

describe("SidePanel below a laptop's width", () => {
  it("makes the page it covers inert, until it closes", async () => {
    // A phone: the panel's breakpoint does not match.
    // Safe: the panel reads only `matches` and the change listeners of the list.
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    renderWithI18n(
      <div data-slot="sidebar-wrapper">
        <header>
          <button type="button">Toggle the sidebar</button>
        </header>
        <PanelOpener />
      </div>,
    )
    const toggle = screen.getByRole("button", { name: "Toggle the sidebar" })

    await userEvent.click(screen.getByRole("button", { name: "Memory" }))
    expect(toggle.closest("[inert]")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Forget" }).closest("[inert]")).toBeNull()

    await userEvent.keyboard("{Escape}")
    expect(toggle.closest("[inert]")).toBeNull()
    expect(screen.getByRole("button", { name: "Memory" })).toHaveFocus()
    matchMedia.mockRestore()
  })
})

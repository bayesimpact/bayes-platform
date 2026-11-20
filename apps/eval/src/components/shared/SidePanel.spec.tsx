import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, StrictMode, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { renderWithI18n } from "@/test/render-with-i18n"
import { SidePanel } from "./SidePanel"

/** Says whether the app's sidebar is open, for the tests to read. */
function SidebarState() {
  const { open } = useSidebar()
  return <output aria-label="Sidebar">{open ? "open" : "folded"}</output>
}

function PanelOpener({ children }: { children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    // The panel folds the app's sidebar when it leaves the page no room: it reads its state. The
    // provider is also the frame of the app, which the panel makes inert when it covers it.
    <SidebarProvider>
      <SidebarState />
      {children}
      {/* The page beside the panel, as `SplitPage` lays it out before the panel. */}
      <div data-testid="page">
        <button type="button" onClick={() => setIsOpen((current) => !current)}>
          Memory
        </button>
      </div>
      {isOpen ? (
        <SidePanel title="What the agent remembers" onClose={() => setIsOpen(false)}>
          <button type="button">Forget</button>
        </SidePanel>
      ) : null}
    </SidebarProvider>
  )
}

/** A laptop or a phone: whether the panel's breakpoint, and every other one, matches. */
function mockMatchMedia(matches: boolean) {
  // Safe: the panel reads only `matches` and the change listeners of the list.
  return vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
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
    const matchMedia = mockMatchMedia(false)
    renderWithI18n(
      <PanelOpener>
        <header>
          <button type="button">Toggle the sidebar</button>
        </header>
      </PanelOpener>,
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

describe("SidePanel beside a page with little room", () => {
  /** Opens the panel docked beside a page of that width, and widens it by a step. */
  const stretchBeside = async (pageWidth: number) => {
    const matchMedia = mockMatchMedia(true)
    renderWithI18n(<PanelOpener />)
    // jsdom lays nothing out: the page gets the width the test is about.
    Object.defineProperty(screen.getByTestId("page"), "clientWidth", { value: pageWidth })
    await userEvent.click(screen.getByRole("button", { name: "Memory" }))
    screen.getByRole("separator", { name: "Resize the panel" }).focus()
    await userEvent.keyboard("{ArrowLeft}")
    matchMedia.mockRestore()
  }

  it("folds the sidebar when it opens beside a page with little room", async () => {
    const matchMedia = mockMatchMedia(true)
    renderWithI18n(<PanelOpener />)
    Object.defineProperty(screen.getByTestId("page"), "clientWidth", { value: 300 })

    await userEvent.click(screen.getByRole("button", { name: "Memory" }))
    expect(screen.getByRole("status", { name: "Sidebar" })).toHaveTextContent("folded")
    matchMedia.mockRestore()
  })

  it("folds the sidebar once the page has little room left", async () => {
    await stretchBeside(300)
    expect(screen.getByRole("status", { name: "Sidebar" })).toHaveTextContent("folded")
  })

  it("leaves the sidebar open while the page has room", async () => {
    await stretchBeside(900)
    expect(screen.getByRole("status", { name: "Sidebar" })).toHaveTextContent("open")
  })
})

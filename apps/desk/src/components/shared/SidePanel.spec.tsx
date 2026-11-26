import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, StrictMode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
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
      {/* The page beside the panel, as a conversation or an extraction lays it out before it. */}
      <main>
        <button type="button" onClick={() => setIsOpen((current) => !current)}>
          Memory
        </button>
      </main>
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
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

/** Renders the page at that width, as happy-dom lays nothing out, and opens the panel beside it. */
async function openBeside(pageWidth: number) {
  mockMatchMedia(true)
  renderWithI18n(<PanelOpener />)
  Object.defineProperty(screen.getByRole("main"), "clientWidth", { value: pageWidth })
  await userEvent.click(screen.getByRole("button", { name: "Memory" }))
}

/** Widens the panel by a step from the keyboard, as the person may do with the pointer. */
async function widenPanel() {
  screen.getByRole("separator", { name: "Resize the panel" }).focus()
  await userEvent.keyboard("{ArrowLeft}")
}

const sidebarState = () => screen.getByRole("status", { name: "Sidebar" })

// A failed assertion must not leave the next test on a mocked breakpoint.
afterEach(() => {
  vi.restoreAllMocks()
})

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
    mockMatchMedia(false)
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
    // Covering the page, the panel leaves the sidebar as it is, though the page measures nothing.
    expect(sidebarState()).toHaveTextContent("open")

    await userEvent.keyboard("{Escape}")
    expect(toggle.closest("[inert]")).toBeNull()
    expect(screen.getByRole("button", { name: "Memory" })).toHaveFocus()
  })
})

describe("SidePanel beside a page with little room", () => {
  it("folds the sidebar when it opens beside a page with little room", async () => {
    await openBeside(300)
    expect(sidebarState()).toHaveTextContent("folded")
  })

  it("folds the sidebar once it is stretched so wide that the page has little room left", async () => {
    // happy-dom measures the panel at 0 px: a step reads as the whole width it reaches.
    await openBeside(600)
    expect(sidebarState()).toHaveTextContent("open")

    await widenPanel()
    expect(sidebarState()).toHaveTextContent("folded")
  })

  it("leaves the sidebar open while the page has room", async () => {
    await openBeside(900)
    await widenPanel()
    expect(sidebarState()).toHaveTextContent("open")
  })
})

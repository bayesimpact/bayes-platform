import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { SidebarLayout } from "./SidebarLayout"

// `isStudioInterface` reads `window.location`, which does not exist under vitest's node environment.
vi.mock(import("@/studio/routes/helpers"), async (importOriginal) => ({
  ...(await importOriginal()),
  isStudioInterface: vi.fn(() => true),
}))

// The user menu reads the store and the auth session, which the layout itself does not need.
vi.mock("./nav/NavUserMenuItems", () => ({
  NavUserMenuItems: () => null,
  UserMenuDialogs: () => null,
}))

function renderLayout() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SidebarLayout user={{ name: "Ada Example", email: "ada@example.com" }}>
        <p>Page content</p>
      </SidebarLayout>
    </MemoryRouter>,
  )
}

describe("SidebarLayout", () => {
  it("lets the page shrink beside the sidebar, so a wide table scrolls inside its own box", () => {
    const markup = renderLayout()

    const insetTag = markup.match(/<main[^>]*data-slot="sidebar-inset"[^>]*>/)?.[0]
    expect(insetTag).toBeDefined()
    expect(insetTag).toMatch(/class="[^"]*\bmin-w-0\b[^"]*"/)
    expect(markup).toContain("Page content")
  })
})

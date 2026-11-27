import { HeaderActions } from "@caseai-connect/app-ui/compositions/HeaderActions"
import { SidePanel } from "@caseai-connect/app-ui/compositions/SidePanel"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { AppShell } from "./AppShell"
import { HeaderBack } from "./HeaderBack"

/** The shell around a page, in a router of its own: the shell reads the router to close its sidebar. */
function renderShellAround(page: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  return renderWithI18n(
    <RouterContextProvider router={router}>
      <AppShell header="Logo" footer="User" title="Agent">
        {page}
      </AppShell>
    </RouterContextProvider>,
  )
}

describe("AppShell", () => {
  it("puts a page's back link and its actions in the top bar", async () => {
    renderShellAround(
      <>
        <HeaderBack>
          <a href="/x">Back</a>
        </HeaderBack>
        <HeaderActions>
          <button type="button">Export</button>
        </HeaderActions>
      </>,
    )
    const bar = await screen.findByRole("banner")
    expect(within(bar).getByRole("link", { name: "Back" })).toBeVisible()
    expect(within(bar).getByRole("button", { name: "Export" })).toBeVisible()
  })

  it("keeps the width of a side panel under Evaluation's own key", async () => {
    renderShellAround(
      <SidePanel title="Details" onClose={() => {}}>
        Body
      </SidePanel>,
    )
    // Saved widths survive only while the shell gives the panel the same key.
    screen.getByRole("separator", { name: "Resize the panel" }).focus()
    await userEvent.keyboard("{ArrowLeft}")

    expect(window.localStorage.getItem("eval.sidePanelWidth")).not.toBeNull()
    expect(window.localStorage.getItem("sidePanelWidth")).toBeNull()
  })
})

import { SidePanel } from "@caseai-connect/app-ui/compositions/SidePanel"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { DeskShell } from "./DeskShell"

/** The shell around a page, in a router of its own: the shell reads the router to close its sidebar. */
function renderShellAround(page: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  return renderWithI18n(
    <RouterContextProvider router={router}>
      <DeskShell header="Logo" footer="User" title="Agent">
        {page}
      </DeskShell>
    </RouterContextProvider>,
  )
}

describe("DeskShell", () => {
  it("keeps the width of a side panel under the Desk's own key", async () => {
    renderShellAround(
      <SidePanel title="Details" onClose={() => {}}>
        Body
      </SidePanel>,
    )
    // Saved widths survive only while the shell gives the panel the same key.
    screen.getByRole("separator", { name: "Resize the panel" }).focus()
    await userEvent.keyboard("{ArrowLeft}")

    expect(window.localStorage.getItem("desk.sidePanelWidth")).not.toBeNull()
    expect(window.localStorage.getItem("sidePanelWidth")).toBeNull()
  })
})

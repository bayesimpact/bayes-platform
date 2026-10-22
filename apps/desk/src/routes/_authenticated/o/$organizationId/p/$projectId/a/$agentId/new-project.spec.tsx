import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { delay, HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildProjectAgent } from "@/test/factories/agents.factory"
import { buildDeskWorld } from "@/test/factories/desk-world.factory"
import { buildMyProject } from "@/test/factories/projects.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession: async () => true,
  getAccessToken: async () => "test-token",
}))

beforeEach(() => {
  window.localStorage.clear()
})

describe("an invitation to a project the person was not in", () => {
  it("adds its agent to the switcher, with the page kept on screen", async () => {
    const world = buildDeskWorld()
    const [organization] = world.organizations
    if (!organization) throw new Error("The world has no organization")
    const research = buildMyProject(organization, { name: "Research" })
    const researcher = buildProjectAgent(research, { name: "Research Assistant" })
    server.use(
      // The first handler that matches answers: accepting opens a project of its own.
      http.post("*/api/me/invitations/:invitationId/accept", () => {
        world.invitations = []
        world.projects.push(research)
        return HttpResponse.json({ data: { success: true } }, { status: 201 })
      }),
      // Its agents come after the projects, as they would from a real API.
      http.get(`*/api/organizations/:organizationId/projects/${research.id}/agents`, async () => {
        await delay(100)
        return HttpResponse.json({ data: [researcher] })
      }),
      ...worldHandlers(world),
    )
    renderApp("/app/")
    const composer = await screen.findByRole("textbox", { name: "Message to Helpful Assistant" })
    // A suspended page stays mounted, hidden behind the skeleton of the shell: watch for it.
    let wasPageHidden = false
    const observer = new MutationObserver(() => {
      if (composer.closest(`[style*="display: none"]`)) wasPageHidden = true
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"], subtree: true })

    await userEvent.click(await screen.findByRole("button", { name: "1 pending invitation" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: /^Accept the invitation/ }))

    expect(
      await screen.findByRole("combobox", {
        name: "Switch agent, current agent: Helpful Assistant",
      }),
    ).toBeInTheDocument()
    observer.disconnect()
    expect(wasPageHidden).toBe(false)
  })
})

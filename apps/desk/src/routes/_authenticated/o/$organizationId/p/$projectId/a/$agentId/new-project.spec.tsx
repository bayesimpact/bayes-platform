import { DeskAgentsRoutes, DeskInvitationsRoutes } from "@bayes-platform/desk-contracts"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { delay } from "msw"
import { describe, expect, it } from "vitest"
import { buildProjectAgent } from "@/test/factories/agents.factory"
import { buildDeskWorld } from "@/test/factories/desk-world.factory"
import { buildMyProject } from "@/test/factories/projects.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

describe("an invitation to a project the person was not in", () => {
  it("adds its agent to the switcher, with the page kept on screen", async () => {
    const world = buildDeskWorld()
    const [organization] = world.organizations
    if (!organization) throw new Error("The world has no organization")
    const research = buildMyProject(organization, { name: "Research" })
    const researcher = buildProjectAgent(research, { name: "Research Assistant" })
    server.use(
      // The first handler that matches answers: accepting opens a project of its own.
      mockRoute(DeskInvitationsRoutes.acceptOne, () => {
        world.invitations = []
        world.projects.push(research)
        return { success: true }
      }),
      // Its agents come after the projects, as they would from a real API. The other projects
      // answer as the world says.
      mockRoute(DeskAgentsRoutes.getAllOfProject, async ({ params }) => {
        if (params.projectId !== research.id) {
          return world.agents.filter((agent) => agent.projectId === params.projectId)
        }
        await delay(100)
        return [researcher]
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

    const switcher = await screen.findByRole("button", {
      name: "Switch agent, current agent: Helpful Assistant",
    })
    observer.disconnect()
    expect(wasPageHidden).toBe(false)
    // The agent comes from the new project, not from the invitation's own agent.
    await userEvent.click(switcher)
    const switcherDialog = await screen.findByRole("dialog", { name: "Switch agent" })
    expect(
      await within(switcherDialog).findByRole("option", { name: "Research Assistant" }),
    ).toBeInTheDocument()
  })
})

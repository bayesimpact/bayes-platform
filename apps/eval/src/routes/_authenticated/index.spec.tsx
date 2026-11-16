import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { rememberLastAgent } from "@/features/agents"
import { agentUrlOf, routerPathOf } from "@/test/eval-urls"
import {
  buildEvalWorld,
  buildNoAgentWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/eval-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

describe("the app's home", () => {
  it("opens the only agent, named in the sidebar, with no switcher and the person's menu", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp("/eval/")

    expect(await screen.findByRole("heading", { name: "Hello world!" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(routerPathOf(agentUrlOf(world)))
    expect(screen.queryByRole("combobox", { name: /Switch agent/ })).not.toBeInTheDocument()
    expect(screen.getAllByText("Helpful Assistant")).toHaveLength(1)
    expect(
      await screen.findByRole("button", { name: "Alex Example, menu of alex@example.org" }),
    ).toBeInTheDocument()

    // Once the sidebar is hidden, the bar names the agent.
    await userEvent.click(screen.getByRole("button", { name: "Hide the sidebar" }))
    expect(await screen.findByRole("button", { name: "Show the sidebar" })).toBeInTheDocument()
    expect(screen.getAllByText("Helpful Assistant")).toHaveLength(2)
  })

  it("opens the agent the person opened last", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    const writingHelper = world.agents.find((agent) => agent.name === "Writing Helper")
    rememberLastAgent(writingHelper?.id ?? "")
    const { router } = renderApp("/eval/")

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        routerPathOf(agentUrlOf(world, "Writing Helper")),
      ),
    )
  })

  it("lists the agents of the projects that grant evaluation, by project, and switches agent", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp("/eval/")

    await userEvent.click(
      await screen.findByRole("combobox", {
        // The first agent of the menu: Operations comes before Product.
        name: "Switch agent, current agent: Writing Helper",
      }),
    )
    const list = await screen.findByRole("listbox")
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Writing Helper", "Helpful Assistant", "Document Reader"])
    expect(within(list).queryByText("Support Assistant")).not.toBeInTheDocument()

    await userEvent.click(within(list).getByRole("option", { name: "Document Reader" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        routerPathOf(agentUrlOf(world, "Document Reader")),
      ),
    )
  })

  it("says so when the person's projects have no agent", async () => {
    server.use(...worldHandlers(buildNoAgentWorld()))
    renderApp("/eval/")

    expect(await screen.findByText("Your projects have no agent yet")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Home of Evaluation" })).toBeInTheDocument()
  })
})

describe("the URLs of a project and an agent", () => {
  it("opens a project's agent from the project's URL", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    const onboarding = world.projects.find((project) => project.name === "Onboarding")
    const { router } = renderApp(`/eval/o/${onboarding?.organizationId}/p/${onboarding?.id}`)

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        routerPathOf(agentUrlOf(world, "Writing Helper")),
      ),
    )
  })

  it("finds no agent of a project that does not grant evaluation", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world, "Support Assistant"))

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})

import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { rememberLastAgent } from "@/features/agents"
import {
  agentUrlOf,
  campaignsUrlOf,
  campaignUrlOf,
  evaluationsUrlOf,
  routerPathOf,
} from "@/test/eval-urls"
import {
  buildCampaignManagerWorld,
  buildEvalWorld,
  buildEveryAccessWorld,
  buildNoAgentWorld,
  buildPendingInvitationsWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/eval-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { sidebarMenuEntries, sidebarMenuLink } from "@/test/sidebar-menus"

/** ⌘K on an Apple system, Ctrl+K elsewhere: the keys of both, whichever system runs the tests. */
const COMMAND_CENTER_SHORTCUT = "{Meta>}{Control>}k{/Control}{/Meta}"

describe("the app's home", () => {
  it("opens the only agent, named in the sidebar, with no switcher and the person's menu", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp("/eval/")

    // The sidebar names the agent, and so does the title of its first page.
    expect(await screen.findByRole("heading", { name: "Helpful Assistant" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(routerPathOf(agentUrlOf(world)))
    expect(screen.queryByRole("button", { name: /Switch agent/ })).not.toBeInTheDocument()
    expect(screen.getAllByText("Helpful Assistant")).toHaveLength(2)
    expect(
      await screen.findByRole("button", { name: "Alex Example, menu of alex@example.org" }),
    ).toBeInTheDocument()

    // Once the sidebar is hidden, the bar names the agent.
    await userEvent.click(screen.getByRole("button", { name: "Hide the sidebar" }))
    expect(await screen.findByRole("button", { name: "Show the sidebar" })).toBeInTheDocument()
    expect(screen.getAllByText("Helpful Assistant")).toHaveLength(3)
  })

  it("opens the agent used last for a person with several, with the command center over it", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    const helpfulAssistant = world.agents.find((agent) => agent.name === "Helpful Assistant")
    rememberLastAgent(helpfulAssistant?.id ?? "")
    const { router } = renderApp("/eval/")

    const dialog = await screen.findByRole("dialog", { name: "Switch agent" })
    expect(router.state.location.pathname).toBe(
      routerPathOf(evaluationsUrlOf(world, "Helpful Assistant")),
    )
    // By project, Operations before Product, then by type within a project, without the project
    // that opens the Desk only.
    expect(
      within(dialog)
        .getAllByRole("group")
        .map((group) => group.getAttribute("aria-labelledby"))
        .map((id) => (id ? document.getElementById(id)?.textContent : null)),
    ).toEqual([
      "Onboarding · Operations · Conversation agents",
      "Pricing · Product · Conversation agents",
      "Pricing · Product · Extraction agents",
    ])
    expect(
      within(dialog)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Writing Helper", "Helpful AssistantCurrent", "Document Reader"])
    expect(within(dialog).queryByText("Support Assistant")).not.toBeInTheDocument()

    // Closing it keeps the agent, and a reload does not bring the dialog back.
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    expect(router.state.location.pathname).toBe(
      routerPathOf(evaluationsUrlOf(world, "Helpful Assistant")),
    )
  })

  it("searches a project in the command center the home opens, and opens an agent with Enter", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp("/eval/")

    const dialog = await screen.findByRole("dialog", { name: "Switch agent" })
    await userEvent.type(
      within(dialog).getByRole("combobox", { name: "Search an agent" }),
      "pricing",
    )
    expect(
      within(dialog)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Helpful Assistant", "Document Reader"])

    await userEvent.keyboard("{Enter}")

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        routerPathOf(evaluationsUrlOf(world, "Helpful Assistant")),
      ),
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("switches agent from the button at the top of the sidebar", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(agentUrlOf(world, "Writing Helper"))

    await userEvent.click(
      await screen.findByRole("button", { name: "Switch agent, current agent: Writing Helper" }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Switch agent" })
    await userEvent.click(within(dialog).getByRole("option", { name: /Document Reader/ }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        routerPathOf(evaluationsUrlOf(world, "Document Reader")),
      ),
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("opens the command center with its shortcut, and says so when no agent matches", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world, "Writing Helper"))
    expect(await screen.findByText("No dataset yet")).toBeInTheDocument()

    await userEvent.keyboard(COMMAND_CENTER_SHORTCUT)
    const dialog = await screen.findByRole("dialog", { name: "Switch agent" })
    await userEvent.type(within(dialog).getByRole("combobox", { name: "Search an agent" }), "zzz")

    expect(await within(dialog).findByText("No agent matches this search.")).toBeInTheDocument()
    expect(within(dialog).queryByRole("option")).not.toBeInTheDocument()
  })

  it("gives no command center to a person with a single agent", async () => {
    server.use(...worldHandlers(buildEvalWorld()))
    renderApp("/eval/")
    expect(await screen.findByRole("heading", { name: "Helpful Assistant" })).toBeInTheDocument()

    await userEvent.keyboard(COMMAND_CENTER_SHORTCUT)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Switch agent/ })).not.toBeInTheDocument()
  })

  it("says so when the person's projects have no agent", async () => {
    server.use(...worldHandlers(buildNoAgentWorld()))
    renderApp("/eval/")

    expect(await screen.findByText("Your projects have no agent yet")).toBeInTheDocument()
    // The logo leads back to the platform's home, outside this app.
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/onboarding",
    )
  })
})

describe("the sections of an agent", () => {
  /** The entries of the sidebar's first level: the agent's sections and menus. */
  const sectionLinks = () =>
    [
      ...screen
        .getByRole("navigation", { name: "Sections of Helpful Assistant" })
        .querySelectorAll('[data-sidebar="menu-button"]'),
    ].map((entry) => entry.textContent)

  it("makes the first page a hub for a person who holds several, and opens one from a card", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(agentUrlOf(world))

    const main = within(await screen.findByRole("main"))
    expect(await main.findByRole("link", { name: /^Evaluations/ })).toBeInTheDocument()
    expect(sectionLinks()).toEqual(["Overview", "Evaluations", "Campaigns"])

    await userEvent.click(main.getByRole("link", { name: /^Campaigns/ }))

    expect(await screen.findByRole("heading", { name: "Campaigns" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(routerPathOf(campaignsUrlOf(world)))
  })

  it("opens on the review campaigns of an agent that opens nothing else", async () => {
    const world = buildCampaignManagerWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp("/eval/")

    expect(await screen.findByRole("heading", { name: "Campaigns" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(routerPathOf(campaignsUrlOf(world)))
    expect(sectionLinks()).toEqual(["Campaigns"])
  })

  it("folds Campaigns on a page of Evaluations, and Evaluations on a page of Campaigns", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(evaluationsUrlOf(world))

    const evaluations = await screen.findByRole("button", { name: "Evaluations" })
    expect(evaluations).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "Campaigns" })).not.toHaveAttribute(
      "aria-expanded",
      "true",
    )

    await userEvent.click(screen.getByRole("button", { name: "Campaigns" }))
    await userEvent.click(await screen.findByRole("link", { name: "List all" }))
    expect(await screen.findByRole("heading", { name: "Campaigns" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Campaigns" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(screen.getByRole("button", { name: "Evaluations" })).not.toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("opens on the evaluations of an agent that opens nothing else", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world, "Helpful Assistant"))

    expect(await screen.findByText("No dataset yet")).toBeInTheDocument()
    expect(sectionLinks()).toEqual(["Evaluations"])
  })

  it("finds no evaluations for a person who does not evaluate the agent", async () => {
    const world = buildCampaignManagerWorld()
    server.use(...worldHandlers(world))
    renderApp(evaluationsUrlOf(world))

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })

  it("lists the agent's campaigns in the Campaigns menu, grouped by where they stand", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world))

    expect(await screen.findByRole("link", { name: "Onboarding answers" })).toBeInTheDocument()
    expect(sidebarMenuEntries("Campaigns")).toEqual([
      "List all",
      "New campaign",
      "Active",
      "Support assistant pilot",
      "Draft",
      "Onboarding answers",
      "Closed",
      "Spring review",
    ])

    // A menu folds away, and opens again.
    await userEvent.click(screen.getByRole("button", { name: "Campaigns" }))
    expect(screen.queryByRole("link", { name: "Onboarding answers" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Campaigns" }))
    expect(screen.getByRole("link", { name: "Onboarding answers" })).toBeInTheDocument()
  })

  it("lists the campaigns a person reviews or tests on the agent in Campaigns, a sub-menu per role", async () => {
    const world = buildEveryAccessWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world))

    expect(await screen.findByRole("button", { name: "Tester" })).toBeInTheDocument()
    expect(sectionLinks()).toEqual(["Overview", "Evaluations", "Campaigns"])
    expect(sidebarMenuEntries("Tester")).toEqual(["Active", "Support assistant pilot"])
    expect(sidebarMenuEntries("Reviewer")).toEqual(["Closed", "Spring review"])
    expect(sidebarMenuLink("Tester", "Support assistant pilot")).toHaveAttribute(
      "href",
      `${campaignUrlOf(world, "Support assistant pilot")}/test`,
    )
  })

  it("leaves out the campaigns a person takes part in on another agent", async () => {
    const world = buildEveryAccessWorld()
    for (const campaign of world.campaigns) campaign.agentId = crypto.randomUUID()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world))

    expect(await screen.findByRole("button", { name: "Campaigns" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tester" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reviewer" })).not.toBeInTheDocument()
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
        routerPathOf(evaluationsUrlOf(world, "Writing Helper")),
      ),
    )
  })

  it("opens the command center over a project's agent, where the Studio's app menu leads", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    const pricing = world.projects.find((project) => project.name === "Pricing")
    const { router } = renderApp(`/eval/o/${pricing?.organizationId}/p/${pricing?.id}`)

    expect(await screen.findByRole("dialog", { name: "Switch agent" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(evaluationsUrlOf(world, "Helpful Assistant")),
    )
  })

  it("opens a project's only agent with no command center when the person has no other", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const [project] = world.projects
    renderApp(`/eval/o/${project?.organizationId}/p/${project?.id}`)

    expect(await screen.findByRole("heading", { name: "Helpful Assistant" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("finds no agent of a project that does not grant evaluation", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world, "Support Assistant"))

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})

describe("the invitations", () => {
  it("open from the envelope of the sidebar, and an accepted campaign joins the person's", async () => {
    const world = buildPendingInvitationsWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world))

    await userEvent.click(await screen.findByRole("button", { name: "2 pending invitations" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/Review campaign · Pricing · Product/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Project · Onboarding · Operations/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tester" })).not.toBeInTheDocument()

    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Accept the invitation to Support assistant pilot",
      }),
    )

    expect(await screen.findByText("You joined Support assistant pilot.")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Tester" })).toBeInTheDocument()
    expect(sidebarMenuEntries("Tester")).toEqual(["Active", "Support assistant pilot"])
    expect(await screen.findByRole("button", { name: "1 pending invitation" })).toBeInTheDocument()
  })

  it("can be declined, and the envelope goes with the last one", async () => {
    const world = buildPendingInvitationsWorld()
    world.myInvitations = world.myInvitations.filter(
      (entry) => entry.invitation.targetType === "project",
    )
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world))

    await userEvent.click(await screen.findByRole("button", { name: "1 pending invitation" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Decline the invitation to Onboarding" }),
    )

    expect(
      await screen.findByText("You declined the invitation to Onboarding."),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /pending invitation/ })).not.toBeInTheDocument(),
    )
    expect(world.myInvitations).toEqual([])
  })
})

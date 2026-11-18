import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  agentUrlOf,
  campaignEditorUrlOf,
  campaignOf,
  campaignsUrlOf,
  routerPathOf,
} from "@/test/eval-urls"
import {
  buildEvalWorld,
  buildNoCampaignWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/eval-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { sidebarMenuLink } from "@/test/sidebar-menus"

/** The page, without the sidebar, which names the campaigns and their statuses too. */
const page = () => within(screen.getByRole("main"))

describe("the review campaigns of an agent", () => {
  it("lists the agent's campaigns, newest first, from the sidebar's List all", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(agentUrlOf(world))

    await userEvent.click(await screen.findByRole("link", { name: "List all" }))
    expect(router.state.location.pathname).toBe(routerPathOf(campaignsUrlOf(world)))

    const rows = await screen.findAllByRole("row")
    expect(rows.slice(1).map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual([
      "Onboarding answers",
      "Support assistant pilot",
      "Spring review",
    ])
    expect(within(rows[2] as HTMLElement).getByText("Active")).toBeInTheDocument()
    expect(page().getByRole("link", { name: "New campaign" })).toBeInTheDocument()
  })

  it("opens a campaign from the sidebar's Campaigns menu", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(campaignsUrlOf(world))

    expect(await screen.findByRole("heading", { name: "Campaigns" })).toBeInTheDocument()
    // The way to a new campaign shows in the sidebar and in the page.
    expect(screen.getAllByRole("link", { name: "New campaign" })).toHaveLength(2)

    await userEvent.click(sidebarMenuLink("Campaigns", "Support assistant pilot"))

    expect(await screen.findByRole("heading", { name: "Invite participants" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(campaignEditorUrlOf(world, "Support assistant pilot")),
    )
  })

  it("offers a first campaign when the agent has none", async () => {
    const world = buildNoCampaignWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignsUrlOf(world))

    expect(await screen.findByText("No review campaign yet")).toBeInTheDocument()
    expect(page().getByRole("link", { name: "New campaign" })).toBeInTheDocument()
  })

  it("is not found for a person who does not manage the project's campaigns", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    renderApp(`${agentUrlOf(world, "Helpful Assistant")}/review-campaigns`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Campaigns" })).not.toBeInTheDocument()
  })
})

describe("a new campaign", () => {
  it("starts on its name, then creates a draft with the default questions", async () => {
    const world = buildNoCampaignWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${campaignsUrlOf(world)}/new`)

    const name = await screen.findByRole<HTMLInputElement>("textbox", { name: "Name" })
    expect(name.value).toContain("Campaign for Helpful Assistant")
    expect(screen.getByRole("button", { name: "Campaign" })).toHaveAttribute("aria-current", "step")
    expect(screen.queryByRole("textbox", { name: /^Question \d$/ })).not.toBeInTheDocument()
    await userEvent.clear(name)
    await userEvent.type(name, "Autumn pilot")
    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    // The draft exists: its second step asks what a tester answers after each session.
    expect(await screen.findByRole("heading", { name: "Autumn pilot" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "After each session" })).toBeInTheDocument()
    expect(screen.getAllByRole("textbox", { name: /^Question \d$/ })).toHaveLength(2)
    expect(page().getByText("Draft")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(campaignEditorUrlOf(world, "Autumn pilot")),
    )
    expect(router.state.location.search).toEqual({ step: "session" })
  })

  it("asks for a name before it creates the campaign", async () => {
    const world = buildNoCampaignWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignsUrlOf(world)}/new`)

    await userEvent.clear(await screen.findByRole("textbox", { name: "Name" }))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(await screen.findByText("Give the campaign a name.")).toBeInTheDocument()
    expect(world.campaigns).toEqual([])
  })
})

describe("a draft's setup, step by step", () => {
  it("saves each step, then activates the campaign and opens its invitations", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(campaignEditorUrlOf(world, "Onboarding answers"))

    const name = await screen.findByRole("textbox", { name: "Name" })
    await userEvent.type(name, " 2")
    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(await screen.findByRole("heading", { name: "After each session" })).toBeInTheDocument()
    expect(campaignOf(world, "Onboarding answers 2").status).toBe("draft")
    // A step done reopens from the stepper; the invitations wait for the activation.
    expect(screen.getByRole("button", { name: "Invite" })).toHaveAttribute("aria-disabled", "true")
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("heading", { name: "Final survey" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("heading", { name: "Session review" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    await userEvent.click(await screen.findByRole("button", { name: "Activate the campaign" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Activate “Onboarding answers 2”?",
    })
    await userEvent.click(within(dialog).getByRole("button", { name: "Activate" }))

    expect(await screen.findByRole("heading", { name: "Invite participants" })).toBeInTheDocument()
    expect(page().getByText("Active")).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ step: "invite" })

    await userEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(await screen.findByRole("tab", { name: "Participants" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("saves a step left by Back or by the stepper, not only by Next", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Onboarding answers")}?step=session`)

    const question = await screen.findByRole("textbox", { name: "Question 1" })
    await userEvent.clear(question)
    await userEvent.type(question, "Was the tone right?")
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("textbox", { name: "Name" })).toBeInTheDocument()
    expect(campaignOf(world, "Onboarding answers").testerPerSessionQuestions[0]?.prompt).toBe(
      "Was the tone right?",
    )

    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), " 2")
    await userEvent.click(screen.getByRole("button", { name: "Activate" }))
    expect(await screen.findByRole("button", { name: "Activate the campaign" })).toBeInTheDocument()
    expect(campaignOf(world, "Onboarding answers 2").status).toBe("draft")
  })

  it("asks before leaving the page with changes not saved", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${campaignEditorUrlOf(world, "Onboarding answers")}?step=session`)

    await userEvent.type(await screen.findByRole("textbox", { name: "Question 1" }), " Really?")
    await userEvent.click(screen.getByRole("link", { name: "Spring review" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" })

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(router.state.location.pathname).toBe(
      routerPathOf(campaignEditorUrlOf(world, "Onboarding answers")),
    )

    await userEvent.click(screen.getByRole("link", { name: "Spring review" }))
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Leave" }),
    )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        routerPathOf(campaignEditorUrlOf(world, "Spring review")),
      ),
    )
  })

  it("checks a step's questions before the next one", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Onboarding answers")}?step=session`)

    await userEvent.clear(await screen.findByRole("textbox", { name: "Question 1" }))
    await userEvent.clear(screen.getByRole("textbox", { name: "Options, separated by commas" }))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(await screen.findByText("Write the question.")).toBeInTheDocument()
    expect(screen.getByText("Write two options at least.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "After each session" })).toBeInTheDocument()
  })

  it("asks before it removes a question with text, and removes a blank one at once", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Onboarding answers")}?step=session`)

    await userEvent.click(await screen.findByRole("button", { name: "Remove question 1" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Remove question 1?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }))
    await waitFor(() =>
      expect(screen.getAllByRole("textbox", { name: /^Question \d$/ })).toHaveLength(1),
    )

    await userEvent.click(screen.getByRole("button", { name: "Add a question" }))
    await userEvent.click(screen.getByRole("button", { name: "Remove question 2" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(screen.getAllByRole("textbox", { name: /^Question \d$/ })).toHaveLength(1)
  })

  it("shows the step's form in the preview, the others folded, as the setup stands", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Onboarding answers")}?step=session`)

    const firstQuestion = await screen.findByRole("textbox", { name: "Question 1" })
    await userEvent.click(screen.getByRole("button", { name: "Preview" }))
    const panel = await screen.findByRole("complementary", { name: "Preview" })
    expect(within(panel).getByRole("button", { name: /^After each session/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(within(panel).getByRole("button", { name: /^Final survey/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(within(panel).getByRole("button", { name: /^Session review/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )

    // The panel follows what the person writes, before any save.
    await userEvent.clear(firstQuestion)
    await userEvent.type(firstQuestion, "Was the tone right?")
    expect(within(panel).getByText("Was the tone right?")).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole("button", { name: "Close the panel" }))
    expect(screen.queryByRole("complementary", { name: "Preview" })).not.toBeInTheDocument()
  })
})

describe("a campaign's editor", () => {
  it("deletes a draft after a confirmation, and goes back to the list", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Onboarding answers"))

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByRole("heading", { name: "Campaigns" })).toBeInTheDocument()
    expect(screen.queryByText("Onboarding answers")).not.toBeInTheDocument()
  })

  it("shows the setup of an active campaign as its forms read, with nothing to change", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Support assistant pilot")}?tab=setup`)

    // Each form folds to its title and question count, and opens on a click.
    const afterEachSession = await screen.findByRole("button", { name: /^After each session/ })
    expect(afterEachSession).toHaveAttribute("aria-expanded", "false")
    expect(page().getByRole("button", { name: /^Final survey/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(page().getByRole("button", { name: /^Session review/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    await userEvent.click(afterEachSession)
    expect(await page().findByText("Was the agent's answer clear?")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add a question" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument()
  })

  it("closes an active campaign, which then shows its summary", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Support assistant pilot"))

    await userEvent.click(await screen.findByRole("button", { name: "Close the campaign" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Close the campaign" }))

    expect(await screen.findByText("Mean tester rating")).toBeInTheDocument()
    expect(page().getByText("Closed")).toBeInTheDocument()
  })

  it("opens a closed campaign on its summary", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Spring review"))

    expect(await screen.findByText("4.25")).toBeInTheDocument()
    expect(screen.getByText("The sessions testers started.")).toBeInTheDocument()
  })
})

describe("a campaign's participants", () => {
  it("lists a row per role, and revokes one after a confirmation", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Support assistant pilot"))

    expect(await screen.findAllByText("sam@example.org")).toHaveLength(2)
    expect(screen.getByText("Never signed in")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Revoke lee@example.org" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Revoke lee@example.org?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke" }))

    expect(await screen.findByText("lee@example.org was revoked.")).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Revoke lee@example.org" }),
      ).not.toBeInTheDocument(),
    )
  })

  it("invites people by email, who then wait among the pending invitations", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Support assistant pilot"))

    const emails = await screen.findByRole("textbox", {
      name: "Email addresses, separated by commas or new lines",
    })
    await userEvent.type(emails, "not-an-email")
    await userEvent.click(screen.getByRole("button", { name: "Invite" }))
    expect(await screen.findByText("Write 1 to 200 valid email addresses.")).toBeInTheDocument()

    await userEvent.clear(emails)
    await userEvent.type(emails, "kim@example.org, Pat@example.org")
    await userEvent.click(screen.getByRole("radio", { name: "Reviewer" }))
    await userEvent.click(screen.getByRole("button", { name: "Invite" }))

    expect(await screen.findByText("The invitations were sent by email.")).toBeInTheDocument()
    expect(await screen.findByText("kim@example.org")).toBeInTheDocument()
    expect(screen.getByText("pat@example.org")).toBeInTheDocument()
    expect(emails).toHaveValue("")
  })

  it("takes a pending invitation back after a confirmation", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Support assistant pilot"))

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete the invitation of robin@example.org" }),
    )
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this invitation?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(screen.queryByText("robin@example.org")).not.toBeInTheDocument())
    expect(screen.getByText("alix@example.org")).toBeInTheDocument()
  })
})

describe("a campaign's report", () => {
  it("is a tab of the campaign, at its own URL, and leads back to the others", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(campaignEditorUrlOf(world, "Support assistant pilot"))

    await userEvent.click(await screen.findByRole("tab", { name: "Report" }))
    expect(await screen.findByText("4.50")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(`${campaignEditorUrlOf(world, "Support assistant pilot")}/report`),
    )
    expect(screen.getByRole("tab", { name: "Report" })).toHaveAttribute("aria-selected", "true")

    await userEvent.click(screen.getByRole("tab", { name: "Participants" }))
    expect(await screen.findByRole("heading", { name: "Invite participants" })).toBeInTheDocument()
  })

  it("has no tab while the campaign is a draft, which shows its setup's steps", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Onboarding answers"))

    expect(
      await screen.findByRole("navigation", { name: "Steps of the setup" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  })

  it("shows the headline figures, the answers to each question and the sessions", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Support assistant pilot")}/report`)

    expect(
      await screen.findByRole("heading", { name: "Support assistant pilot" }),
    ).toBeInTheDocument()
    expect(screen.getByText("4.50")).toBeInTheDocument()
    expect(screen.getByText("3 reviews")).toBeInTheDocument()
    // One tab per form, the first one open, then one with the sessions.
    expect(
      screen.getByRole("heading", { name: "Did the agent address your question?" }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("tab", { name: "Final survey" }))
    expect(await screen.findByText(/Free-text answers are not summarized/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("tab", { name: "Sessions" }))
    expect(screen.getByRole("cell", { name: "3, 5" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeInTheDocument()
  })
})

describe("a campaign's actions at phone width", () => {
  it("gathers them in a menu of the top bar, whose confirmation outlives it", async () => {
    // A phone: only the query of the bar's breakpoint matches.
    // Safe: the app reads only `matches` and the change listeners of the list.
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query === "(max-width: 39.99rem)",
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Support assistant pilot"))

    await userEvent.click(await screen.findByRole("button", { name: "Actions of the page" }))
    await userEvent.click(await screen.findByRole("button", { name: "Close the campaign" }))

    expect(
      await screen.findByRole("alertdialog", { name: "Close “Support assistant pilot”?" }),
    ).toBeInTheDocument()
    matchMedia.mockRestore()
  })
})

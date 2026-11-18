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

/** The page, without the sidebar, which names the campaigns and their statuses too. */
const page = () => within(screen.getByRole("main"))

describe("the review campaigns of an agent", () => {
  it("lists the agent's campaigns, newest first, with a link in the sidebar", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world))

    const sections = await screen.findByRole("navigation", {
      name: "Sections of Helpful Assistant",
    })
    await userEvent.click(within(sections).getByRole("link", { name: "Review campaigns" }))

    const rows = await screen.findAllByRole("row")
    expect(rows.slice(1).map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual([
      "Onboarding answers",
      "Support assistant pilot",
      "Spring review",
    ])
    expect(within(rows[2] as HTMLElement).getByText("Active")).toBeInTheDocument()
    expect(page().getByRole("link", { name: "New campaign" })).toBeInTheDocument()
  })

  it("lists them in the sidebar, the active one first, and opens one from there", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(campaignsUrlOf(world))

    const active = await screen.findByRole("link", { name: "Support assistant pilot Active" })
    const sidebarCampaigns = screen
      .getAllByRole("link")
      .map((link) => link.textContent)
      .filter((text) => /(Active|Draft|Closed)$/.test(text ?? ""))
    expect(sidebarCampaigns).toEqual([
      "Support assistant pilotActive",
      "Onboarding answersDraft",
      "Spring reviewClosed",
    ])
    // The way to a new campaign shows in the sidebar and in the page.
    expect(screen.getAllByRole("link", { name: "New campaign" })).toHaveLength(2)

    await userEvent.click(active)

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
    expect(screen.queryByRole("link", { name: "Review campaigns" })).not.toBeInTheDocument()
  })
})

describe("a new campaign", () => {
  it("starts from default questions, and opens as a draft once created", async () => {
    const world = buildNoCampaignWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${campaignsUrlOf(world)}/new`)

    const name = await screen.findByRole<HTMLInputElement>("textbox", { name: "Name" })
    expect(name.value).toContain("Campaign for Helpful Assistant")
    expect(screen.getAllByRole("textbox", { name: /^Question \d$/ })).toHaveLength(4)
    await userEvent.clear(name)
    await userEvent.type(name, "Autumn pilot")
    await userEvent.click(screen.getByRole("button", { name: "Create the campaign" }))

    expect(await screen.findByRole("heading", { name: "Autumn pilot" })).toBeInTheDocument()
    expect(page().getByText("Draft")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(campaignEditorUrlOf(world, "Autumn pilot")),
    )
  })

  it("asks for a name, a text for each question and two options for a single choice", async () => {
    const world = buildNoCampaignWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignsUrlOf(world)}/new`)

    await userEvent.clear(await screen.findByRole("textbox", { name: "Name" }))
    await userEvent.clear(screen.getAllByRole("textbox", { name: "Question 1" })[0] as HTMLElement)
    await userEvent.clear(screen.getByRole("textbox", { name: "Options, separated by commas" }))
    await userEvent.click(screen.getByRole("button", { name: "Create the campaign" }))

    expect(await screen.findByText("Give the campaign a name.")).toBeInTheDocument()
    expect(screen.getByText("Write the question.")).toBeInTheDocument()
    expect(screen.getByText("Write two options at least.")).toBeInTheDocument()
  })
})

describe("a campaign's editor", () => {
  it("saves a draft's setup, then activates it after a confirmation", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Onboarding answers"))

    const name = await screen.findByRole("textbox", { name: "Name" })
    await userEvent.type(name, " 2")
    // The setup has changes: activating would leave them out.
    expect(screen.getByRole("button", { name: "Activate" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("The campaign was saved.")).toBeInTheDocument()
    expect(campaignOf(world, "Onboarding answers 2").status).toBe("draft")

    await waitFor(() => expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled())
    await userEvent.click(screen.getByRole("button", { name: "Activate" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Activate “Onboarding answers 2”?",
    })
    await userEvent.click(within(dialog).getByRole("button", { name: "Activate" }))

    // Once active, the campaign opens on its participants, and its setup no longer changes.
    expect(await screen.findByRole("heading", { name: "Invite participants" })).toBeInTheDocument()
    expect(page().getByText("Active")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument()
  })

  it("shows the forms as the setup stands, in a panel beside it", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Onboarding answers"))

    const firstQuestion = (await screen.findAllByRole("textbox", { name: "Question 1" }))[0]
    await userEvent.click(screen.getByRole("button", { name: "Preview" }))
    const panel = await screen.findByRole("complementary", { name: "Preview" })
    expect(within(panel).getByRole("heading", { name: "After each session" })).toBeInTheDocument()
    expect(within(panel).getByRole("heading", { name: "Final survey" })).toBeInTheDocument()
    expect(within(panel).getByRole("heading", { name: "Review of a session" })).toBeInTheDocument()

    // The panel follows what the person writes, before any save.
    await userEvent.clear(firstQuestion as HTMLElement)
    await userEvent.type(firstQuestion as HTMLElement, "Was the tone right?")
    expect(within(panel).getByText("Was the tone right?")).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole("button", { name: "Close the panel" }))
    expect(screen.queryByRole("complementary", { name: "Preview" })).not.toBeInTheDocument()
  })

  it("deletes a draft after a confirmation, and goes back to the list", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(campaignEditorUrlOf(world, "Onboarding answers"))

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByRole("heading", { name: "Review campaigns" })).toBeInTheDocument()
    expect(screen.queryByText("Onboarding answers")).not.toBeInTheDocument()
  })

  it("shows the setup of an active campaign as it is, with nothing to save", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Support assistant pilot")}?tab=setup`)

    expect(await screen.findByRole("textbox", { name: "Name" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add a question" })).not.toBeInTheDocument()
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

  it("invites nobody to a draft", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Onboarding answers")}?tab=participants`)

    expect(await screen.findByText(/Activate the campaign to invite/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument()
  })
})

describe("a campaign's report", () => {
  it("shows the headline figures, the answers to each question and the sessions", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignEditorUrlOf(world, "Support assistant pilot")}/report`)

    expect(await screen.findByRole("heading", { name: "Campaign report" })).toBeInTheDocument()
    expect(screen.getByText("4.50")).toBeInTheDocument()
    expect(screen.getByText("3 reviews")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Did the agent address your question?" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Free-text answers are not summarized/)).toBeInTheDocument()
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
    expect(await screen.findByRole("link", { name: "Report" })).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Close the campaign" }))

    expect(
      await screen.findByRole("alertdialog", { name: "Close “Support assistant pilot”?" }),
    ).toBeInTheDocument()
    matchMedia.mockRestore()
  })
})

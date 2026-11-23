import { EvalReviewerRoutes } from "@caseai-connect/eval-contracts"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import {
  campaignOf,
  campaignUrlOf,
  reviewSessionUrlOf,
  routerPathOf,
  testerSessionUrlOf,
} from "@/test/eval-urls"
import { buildEveryAccessWorld, buildParticipantWorld } from "@/test/factories/eval-world.factory"
import { writeMessage } from "@/test/message-box"
import { worldHandlers } from "@/test/msw/handlers"
import { mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { sidebarMenuEntries, sidebarMenuLink } from "@/test/sidebar-menus"

describe("a person who only takes part in campaigns", () => {
  it("opens on their first campaign, with their campaigns in the sidebar and no agent", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp("/eval/")

    expect(await screen.findByRole("heading", { name: "Pricing questions" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(`${campaignUrlOf(world, "Pricing questions")}/review`),
    )
    // The three campaigns review the same agent: its menus list them by role. The page is a
    // reviewer's, so Tester folds until the person opens it.
    expect(sidebarMenuEntries("Reviewer")).toEqual([
      "Active",
      "Pricing questions",
      "Closed",
      "Spring review",
    ])
    await userEvent.click(screen.getByRole("button", { name: "Tester" }))
    expect(sidebarMenuEntries("Tester")).toEqual(["Active", "Support assistant pilot"])
    expect(screen.queryByRole("button", { name: /Switch agent/ })).not.toBeInTheDocument()
  })

  it("finds no page for the role they do not hold in a campaign", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Support assistant pilot")}/review`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})

describe("a reviewer's campaign", () => {
  it("lists the sessions, with those left to review", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Pricing questions")}/review`)

    expect(await screen.findByText("3 sessions · 2 to review")).toBeInTheDocument()
    // How long ago the campaign was created, which the full date and time explain on hover.
    expect(
      screen.getByText((_text, element) => /^Created .+ ago$/.test(element?.textContent ?? "")),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /^Review session/ })).toHaveLength(2)
    expect(screen.getAllByRole("link", { name: /^View session/ })).toHaveLength(1)
  })

  it("opens a session from the list", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${campaignUrlOf(world, "Pricing questions")}/review`)

    const [firstSession] = await screen.findAllByRole("link", { name: /^Review session/ })
    await userEvent.click(firstSession as HTMLElement)

    expect(await screen.findByRole("complementary", { name: "Session review" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(reviewSessionUrlOf(world, "Pricing questions", 0)),
    )
  })

  it("keeps the agent's sidebar for who holds the agent, the campaign in the Reviewer menu", async () => {
    const world = buildEveryAccessWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Spring review")}/review`)

    expect(await screen.findByRole("heading", { name: "Spring review" })).toBeInTheDocument()
    expect(
      screen.getByRole("navigation", { name: "Sections of Helpful Assistant" }),
    ).toBeInTheDocument()
    expect(sidebarMenuLink("Reviewer", "Spring review")).toHaveAttribute("data-active", "true")
  })

  it("folds the other sub-menus of Campaigns, and opens them again on a page that is theirs", async () => {
    const world = buildEveryAccessWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Spring review")}/review`)

    expect(await screen.findByRole("button", { name: "Reviewer" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(screen.getByRole("button", { name: "Campaigns" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(screen.getByRole("button", { name: "Tester" })).not.toHaveAttribute(
      "aria-expanded",
      "true",
    )

    await userEvent.click(screen.getByRole("link", { name: "List all" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reviewer" })).not.toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    )
  })

  it("lists the open campaign's sessions under it in the sidebar, those to review first", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${campaignUrlOf(world, "Pricing questions")}/review`)

    const toReview = await screen.findAllByRole("img", { name: "To review" })
    const reviewed = screen.getAllByRole("img", { name: "Reviewed" })
    expect(toReview).toHaveLength(2)
    expect(reviewed).toHaveLength(1)
    // To review first: the last mark of the list is the session reviewed.
    const marks = screen.getAllByRole("img", { name: /^(To review|Reviewed)$/ })
    expect(marks.at(-1)).toHaveAccessibleName("Reviewed")

    const firstLink = toReview[0]?.closest("a")
    await userEvent.click(firstLink as HTMLElement)

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/\/review\/sessions\/[0-9a-f-]+$/),
    )
    expect(firstLink).toHaveAttribute("data-active", "true")
  })

  it("hides the tester's opinion until the reviewer submits, then shows it with the other reviews", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(reviewSessionUrlOf(world, "Pricing questions", 0))

    // Blind: the factual answer shows, the tester's rating and comment do not.
    expect(await screen.findByRole("heading", { name: "Session facts" })).toBeInTheDocument()
    expect(screen.getByText("Did the agent address your question?")).toBeInTheDocument()
    expect(screen.queryByText("Clear answers, a bit long.")).not.toBeInTheDocument()
    expect(screen.getByText("1 other reviewer reviewed this session.")).toBeInTheDocument()
    expect(screen.getByText(/For a team of five/)).toBeInTheDocument()

    // The form asks for the rating and the required question.
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }))
    expect(await screen.findByText("Give a rating from 1 to 5 stars.")).toBeInTheDocument()
    expect(screen.getByText("Answer this question.")).toBeInTheDocument()

    const rating = screen.getByRole("radiogroup", { name: /Your rating/ })
    await userEvent.click(within(rating).getByRole("radio", { name: "4 stars" }))
    const correct = screen.getByRole("radiogroup", {
      name: /Were the agent's answers factually correct/,
    })
    await userEvent.click(within(correct).getByRole("radio", { name: "5 stars" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Comment" }), "Right on both.")
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }))

    expect(await screen.findByText("Your review was saved.")).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "Tester feedback" })).toBeInTheDocument()
    expect(screen.getByText("Clear answers, a bit long.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Other reviewers" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
    const session = world.reviewSessions[campaignOf(world, "Pricing questions").id]?.[0]
    expect(session?.myReview).toMatchObject({ overallRating: 4, comment: "Right on both." })
  })

  it("shows the session as the tester's chat did, only to read", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(reviewSessionUrlOf(world, "Pricing questions", 0))

    // The reply keeps its steps, its sources and its resources, as the tester saw them.
    expect(await screen.findByText("Used 1 source")).toBeInTheDocument()
    expect(screen.getByText("Plans compared, in two minutes")).toBeInTheDocument()
    expect(screen.getByText(/^Used (a tool|tools)$/)).toBeInTheDocument()
    // A reviewer reads the reply: no feedback on it.
    expect(screen.queryByRole("button", { name: "Good reply" })).not.toBeInTheDocument()
  })

  it("reads the HTML of a reply's MCP App through the reviewer's own route", async () => {
    const world = buildParticipantWorld()
    const campaign = campaignOf(world, "Pricing questions")
    const reply = world.reviewSessions[campaign.id]?.[0]?.transcript[1]
    reply?.toolCalls.push({
      id: "call-app",
      name: "show_plans",
      arguments: {},
      result: { content: [{ type: "text", text: "Plans" }] },
      mcpApp: { mcpServerId: "server-1", resourceUri: "ui://plans" },
    })
    let htmlReads = 0
    server.use(
      // Before the world's handlers, which answer the same route.
      mockRoute(EvalReviewerRoutes.getSessionMcpAppHtml, () => {
        htmlReads++
        return []
      }),
      ...worldHandlers(world),
    )
    renderApp(reviewSessionUrlOf(world, "Pricing questions", 0))

    expect(await screen.findByText("Used 1 source")).toBeInTheDocument()
    await waitFor(() => expect(htmlReads).toBe(1))
  })

  it("shows the form the agent filled, and what it did not collect", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(reviewSessionUrlOf(world, "Pricing questions", 1))

    expect(await screen.findByRole("heading", { name: "Captured form" })).toBeInTheDocument()
    expect(screen.getByText("Plan for a team of five")).toBeInTheDocument()
    expect(screen.getByText("Not collected")).toBeInTheDocument()
  })

  it("shows a closed campaign's review as it is, with nothing to submit", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(reviewSessionUrlOf(world, "Spring review", 0))

    expect(await screen.findByRole("heading", { name: "Your review" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Comment" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument()
  })

  it("reads the campaign's report", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${campaignUrlOf(world, "Pricing questions")}/review`)

    await userEvent.click(await screen.findByRole("tab", { name: "Report" }))

    expect(await screen.findByText("Mean reviewer rating")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Report", selected: true })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(`${campaignUrlOf(world, "Pricing questions")}/review/report`),
    )
  })
})

describe("a tester's campaign", () => {
  it("lists their sessions, and takes their feedback on one, once", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Support assistant pilot")}/test`)

    expect(await screen.findByText("2 sessions")).toBeInTheDocument()
    expect(screen.getAllByText("Feedback given")).toHaveLength(1)
    await userEvent.click(screen.getByRole("button", { name: /^Give feedback on the session/ }))

    const dialog = await screen.findByRole("dialog", { name: "How was this session?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit feedback" }))
    expect(await within(dialog).findByText("Give a rating from 1 to 5 stars.")).toBeInTheDocument()

    const overall = within(dialog).getByRole("radiogroup", { name: /Overall rating/ })
    await userEvent.click(within(overall).getByRole("radio", { name: "5 stars" }))
    const clarity = within(dialog).getByRole("radiogroup", { name: /Was the agent's answer clear/ })
    await userEvent.click(within(clarity).getByRole("radio", { name: "4 stars" }))
    await userEvent.click(within(dialog).getByRole("radio", { name: "Partially" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit feedback" }))

    expect(await screen.findByText("Your feedback was saved.")).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText("Feedback given")).toHaveLength(2))
    expect(screen.queryByRole("button", { name: /^Give feedback on/ })).not.toBeInTheDocument()
  })

  it("deletes a session with no feedback, after a confirmation", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Support assistant pilot")}/test`)

    await userEvent.click(await screen.findByRole("button", { name: /^Delete the session of/ }))
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this session?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("1 session")).toBeInTheDocument()
  })

  it("starts a session with the agent, and opens it", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${campaignUrlOf(world, "Support assistant pilot")}/test`)

    await userEvent.click(await screen.findByRole("button", { name: "Start a session" }))

    const campaign = campaignOf(world, "Support assistant pilot")
    await waitFor(() => expect(world.testerSessions[campaign.id]).toHaveLength(3))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        routerPathOf(
          `${campaignUrlOf(world, "Support assistant pilot")}/test/sessions/${world.testerSessions[campaign.id]?.[0]?.id}`,
        ),
      ),
    )
  })

  it("lists the tester's sessions under the open campaign in the sidebar", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Support assistant pilot")}/test`)

    expect(await screen.findByRole("img", { name: "Feedback to give" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Feedback given" })).toBeInTheDocument()
  })

  it("opens the final survey in its tab", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${campaignUrlOf(world, "Support assistant pilot")}/test`)

    await userEvent.click(await screen.findByRole("tab", { name: "Final survey" }))

    expect(
      await screen.findByRole("tab", { name: "Final survey", selected: true }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      routerPathOf(`${campaignUrlOf(world, "Support assistant pilot")}/test/survey`),
    )
  })

  it("opens the final survey only once a session has the tester's feedback", async () => {
    const world = buildParticipantWorld()
    const campaign = campaignOf(world, "Support assistant pilot")
    for (const session of world.testerSessions[campaign.id] ?? []) {
      session.feedbackStatus = "pending"
    }
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Support assistant pilot")}/test`)

    expect(await screen.findByRole("button", { name: "Start a session" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Fill the final survey" })).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Final survey" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  it("fills the final survey once, then offers to edit it", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(`${campaignUrlOf(world, "Support assistant pilot")}/test`)

    await userEvent.click(await screen.findByRole("link", { name: "Fill the final survey" }))
    const overall = await screen.findByRole("radiogroup", { name: /Overall rating/ })
    await userEvent.click(within(overall).getByRole("radio", { name: "3 stars" }))
    const satisfaction = screen.getByRole("radiogroup", { name: /How satisfied are you/ })
    await userEvent.click(within(satisfaction).getByRole("radio", { name: "4 stars" }))
    await userEvent.type(
      screen.getByRole("textbox", { name: "What should we improve first?" }),
      "Shorter answers.",
    )
    await userEvent.click(screen.getByRole("button", { name: "Submit survey" }))

    expect(await screen.findByText("Your survey was saved.")).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Edit my survey" })).toBeInTheDocument()
    const campaign = campaignOf(world, "Support assistant pilot")
    expect(world.testerSurveys[campaign.id]).toMatchObject({
      overallRating: 3,
      answers: [
        { questionId: "satisfaction", value: 4 },
        { questionId: "improve", value: "Shorter answers." },
      ],
    })
  })
})

describe("a tester's session with the agent", () => {
  it("shows the conversation, and streams the agent's reply to a new message", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(testerSessionUrlOf(world, "Support assistant pilot", 0))

    expect(await screen.findByText(/For a team of five/)).toBeInTheDocument()
    // The tester knows the reviewers read the session.
    expect(
      screen.getByText(
        "The reviewers of this campaign can read everything exchanged in this session.",
      ),
    ).toBeInTheDocument()
    // The documents the reply relied on show under it, as in the Desk.
    expect(screen.getByText("Used 1 source")).toBeInTheDocument()
    // The way back leads to the campaign's sessions.
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      `${campaignUrlOf(world, "Support assistant pilot")}/test`,
    )
    await writeMessage(
      screen.getByRole("textbox", { name: "Message to Helpful Assistant" }),
      "Can we pay monthly?",
      { send: true },
    )

    expect(
      await screen.findByText(/Here is what I found about "Can we pay monthly\?"/),
    ).toBeInTheDocument()
    expect(screen.getByText("Can we pay monthly?")).toBeInTheDocument()
  })

  it("ends with the tester's feedback, then goes back to the campaign", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(testerSessionUrlOf(world, "Support assistant pilot", 0))

    await userEvent.click(
      await screen.findByRole("button", { name: "End the session and give feedback" }),
    )
    // The feedback opens beside the conversation, which stays in view.
    const panel = await screen.findByRole("complementary", { name: "How was this session?" })
    expect(screen.getByText("Which plan should a team of five pick?")).toBeInTheDocument()
    const overall = within(panel).getByRole("radiogroup", { name: /Overall rating/ })
    await userEvent.click(within(overall).getByRole("radio", { name: "4 stars" }))
    const clarity = within(panel).getByRole("radiogroup", { name: /Was the agent's answer clear/ })
    await userEvent.click(within(clarity).getByRole("radio", { name: "4 stars" }))
    await userEvent.click(within(panel).getByRole("radio", { name: "Yes" }))
    await userEvent.click(within(panel).getByRole("button", { name: "Submit feedback" }))

    expect(await screen.findByRole("heading", { name: "Your sessions" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText("Feedback given")).toHaveLength(2))
  })

  it("keeps a session whose feedback is given readable, with no way to end it again", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(testerSessionUrlOf(world, "Support assistant pilot", 1))

    expect(await screen.findByText(/You can change plan at any time/)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "End the session and give feedback" }),
    ).not.toBeInTheDocument()
  })

  it("is not found for a session that is not the tester's", async () => {
    const world = buildParticipantWorld()
    server.use(...worldHandlers(world))
    renderApp(
      `${campaignUrlOf(world, "Support assistant pilot")}/test/sessions/${crypto.randomUUID()}`,
    )

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})

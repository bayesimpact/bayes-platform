import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { agentUrlOf, conversationOf, conversationUrlOf } from "@/test/desk-urls"
import { buildDeskWorld, type DeskWorld } from "@/test/factories/desk-world.factory"
import { hiddenFileInput } from "@/test/file-input"
import { worldHandlers } from "@/test/msw/handlers"
import { apiError, mockRoute, mockStreamRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { required } from "@/test/required"

/** The main world, served by the mocked API, which the test reads back. */
function serveDeskWorld(): DeskWorld {
  const world = buildDeskWorld()
  server.use(...worldHandlers(world))
  return world
}

/** The messages of the latest conversation of the world, as the API keeps them. */
const savedMessagesOf = (world: DeskWorld) => world.messages[conversationOf(world).id] ?? []

/** The values of a list of terms, such as a form's fields, by term. */
function definitionsIn(container: HTMLElement): Record<string, string | undefined> {
  const terms = within(container).getAllByRole("term")
  const definitions = within(container).getAllByRole("definition")
  return Object.fromEntries(
    terms.map((term, index) => [term.textContent, definitions[index]?.textContent]),
  )
}

describe("a conversation", () => {
  it("shows its messages, without the tool results, and the steps of each reply", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    expect(await screen.findByText(/Here is a short comparison/)).toBeInTheDocument()
    expect(screen.getByText("Hello! How can I help you today?")).toBeInTheDocument()
    expect(screen.getByText("Used tools")).toBeInTheDocument()
  })

  it("offers to try again when it could not load, and loads it", async () => {
    const world = serveDeskWorld()
    server.use(mockRoute(DeskConversationsRoutes.getMessages, () => apiError(503), { once: true }))
    renderApp(conversationUrlOf(world))

    expect(await screen.findByText("This page could not load")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText(/Here is a short comparison/)).toBeInTheDocument()
  })

  it("shows the resources a reply points to and the sources it relied on", async () => {
    const world = serveDeskWorld()
    const tab = { opener: null, location: { href: "" }, close: vi.fn() }
    // Safe: the Desk only sets the new tab's `opener` and `location.href`, or closes it, which
    // this stand-in for a browser tab has.
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window)
    renderApp(conversationUrlOf(world))

    expect(await screen.findByRole("link", { name: /Plan comparison/ })).toHaveAttribute(
      "href",
      "https://example.org/plans",
    )
    await userEvent.click(screen.getByRole("button", { name: "Used 2 sources" }))
    expect(await screen.findByText("The Pro plan covers unlimited teams…")).toBeInTheDocument()
    expect(screen.getByText("Support answers by email…")).toBeInTheDocument()

    // The shared document opens; the crawled page has no file to open.
    await userEvent.click(await screen.findByRole("button", { name: "Open Pricing guide.pdf" }))
    expect(open).toHaveBeenCalledWith("", "_blank")
    await waitFor(() => expect(tab.location.href).toBe("https://example.org/pricing-guide.pdf"))
    expect(screen.queryByRole("button", { name: "Open Help center" })).not.toBeInTheDocument()
  })

  it("opens a resource a reply points to beside the conversation: a video plays, a page shows", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    await userEvent.click(await screen.findByRole("link", { name: /Product tour/ }))
    const video = await screen.findByRole("complementary", { name: "Product tour" })
    expect(within(video).getByTitle("Product tour")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1&rel=0",
    )
    expect(within(video).getByRole("link", { name: /Open on YouTube/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    )

    // Another resource takes the panel's place.
    await userEvent.click(screen.getByRole("link", { name: /Plan comparison/ }))
    const page = await screen.findByRole("complementary", { name: "Plan comparison" })
    expect(within(page).getByTitle("Plan comparison")).toHaveAttribute(
      "src",
      "https://example.org/plans",
    )
    expect(within(page).getByRole("link", { name: /Open in a new tab/ })).toHaveAttribute(
      "href",
      "https://example.org/plans",
    )
    await userEvent.click(within(page).getByRole("button", { name: "Close the panel" }))
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
  })

  it("hides the sources when the project does not show them", async () => {
    const world = serveDeskWorld()
    for (const project of world.projects) project.featureFlags = []
    renderApp(conversationUrlOf(world))

    expect(await screen.findByRole("link", { name: /Plan comparison/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Used \d+ sources?/ })).not.toBeInTheDocument()
  })

  it("streams the reply to a message, then lets the person write again", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    const messageBox = await screen.findByRole("textbox", { name: "Message to Helpful Assistant" })
    await userEvent.type(messageBox, "Which plan suits a team of five?{Enter}")

    expect(
      await screen.findByText(/Here is what I found about "Which plan suits a team of five\?"/),
    ).toBeInTheDocument()
    expect(screen.getByText("Which plan suits a team of five?")).toBeInTheDocument()
    expect(messageBox).toHaveValue("")
    // The greeting, the first reply and the new one.
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Copy the reply" })).toHaveLength(3),
    )
  })

  it("keeps showing a new message in place once the server saved it", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    const messageBox = await screen.findByRole("textbox", { name: "Message to Helpful Assistant" })
    await userEvent.type(messageBox, "Which plan suits a team of five?{Enter}")
    // The scroller would read a new element as a new message to scroll to: the sent one keeps its.
    const sentMessage = screen.getByText("Which plan suits a team of five?")

    // A saved reply can be reported: the greeting, the first reply, and now the new one.
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Report a problem" })).toHaveLength(3),
    )
    expect(screen.getByText("Which plan suits a team of five?")).toBe(sentMessage)
  })

  it("starts with the first message written on the agent's page", async () => {
    const world = serveDeskWorld()
    const { router } = renderApp(agentUrlOf(world))

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Message to Helpful Assistant" }),
      "Summarize our refund policy{Enter}",
    )

    expect(
      await screen.findByText(/Here is what I found about "Summarize our refund policy"/),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/as\/[0-9a-f-]+$/)
    expect(
      await screen.findByRole("link", { name: "Summarize our refund policy" }),
    ).toBeInTheDocument()
  })

  it("shows the server's reason when the agent fails, and sends the message again", async () => {
    const world = serveDeskWorld()
    server.use(
      mockStreamRoute(
        DeskConversationsRoutes.streamReply,
        () => [{ thrownError: "The model is overloaded" }],
        { once: true },
      ),
    )
    renderApp(conversationUrlOf(world))

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Message to Helpful Assistant" }),
      "Hello{Enter}",
    )

    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("The model is overloaded")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText(/Here is what I found about "Hello"/)).toBeInTheDocument()
  })

  it("fails a reply whose stream closes before it ends", async () => {
    const world = serveDeskWorld()
    server.use(
      mockStreamRoute(
        DeskConversationsRoutes.streamReply,
        () => [{ event: { type: "start", messageId: crypto.randomUUID() } }],
        { once: true },
      ),
    )
    renderApp(conversationUrlOf(world))

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Message to Helpful Assistant" }),
      "Hello{Enter}",
    )

    expect(await screen.findByText("The reply stopped before it finished.")).toBeInTheDocument()
  })

  it("is deleted from the history after a confirmation, and leaves for a new one", async () => {
    const world = serveDeskWorld()
    const { router } = renderApp(conversationUrlOf(world))

    await userEvent.click(
      await screen.findByRole("button", { name: "Actions on Compare the plans" }),
    )
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).not.toContain("/as/")
    expect(screen.queryByRole("link", { name: "Compare the plans" })).not.toBeInTheDocument()
  })

  it("is deleted from the menu of its page, named in the confirmation", async () => {
    const world = serveDeskWorld()
    const { router } = renderApp(conversationUrlOf(world))

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete the conversation" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/"Compare the plans" and its messages/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(
      await screen.findByRole("heading", { name: "How can I help you today?" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).not.toContain("/as/")
  })

  it("sends a file with a message, and opens it afterwards", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    await screen.findByRole("textbox", { name: "Message to Helpful Assistant" })
    const file = new File(["%PDF-1.7"], "invoice.pdf", { type: "application/pdf" })
    await userEvent.upload(hiddenFileInput(), file)
    expect(screen.getByRole("button", { name: "Remove invoice.pdf" })).toBeInTheDocument()
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message to Helpful Assistant" }),
      "Read this invoice{Enter}",
    )

    expect(
      await screen.findByText(/Here is what I found about "Read this invoice"/),
    ).toBeInTheDocument()
    // Once persisted, the message names its file by its document, which opens.
    expect(await screen.findByRole("button", { name: "Open Attachment" })).toBeInTheDocument()
  })

  it("refuses a file that is not a PDF or an image", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    await screen.findByRole("textbox", { name: "Message to Helpful Assistant" })
    await userEvent.upload(hiddenFileInput(), new File(["a,b"], "rows.csv", { type: "text/csv" }), {
      applyAccept: false,
    })

    expect(await screen.findByText("Attach a PDF, PNG or JPEG file.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove rows.csv" })).not.toBeInTheDocument()
  })

  it("shows the form the agent fills in", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    await userEvent.click(await screen.findByRole("button", { name: "Form in progress" }))
    const panel = await screen.findByRole("complementary", { name: "What the agent noted" })

    expect(definitionsIn(panel)).toEqual({ "Team size": "5", Plan: "Pro", "Start date": "—" })
  })

  it("asks before the agent remembers a fact, which the person can reword", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    expect(await screen.findByText("Works in a team of five")).toBeInTheDocument()
    expect(screen.getByText("The agent remembers")).toBeInTheDocument()
    const proposal = screen
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText("Should the agent remember this?"))
    expect(proposal).toHaveTextContent("Prefers short answers")

    await userEvent.click(screen.getByRole("button", { name: "Reword" }))
    const fact = screen.getByRole("textbox", { name: "The fact to remember" })
    await userEvent.clear(fact)
    await userEvent.type(fact, "Likes short answers")
    await userEvent.click(screen.getByRole("button", { name: "Remember" }))

    expect(await screen.findByText("Likes short answers")).toBeInTheDocument()
    expect(screen.queryByText("Should the agent remember this?")).not.toBeInTheDocument()
  })

  it("forgets what the agent remembers, one fact or all of them", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    await userEvent.click(await screen.findByRole("button", { name: "Memory (2)" }))
    const panel = await screen.findByRole("complementary", { name: "What the agent remembers" })
    await userEvent.click(
      within(panel).getByRole("button", { name: 'Forget "Works in a team of five"' }),
    )
    expect(await within(panel).findByText("Prefers short answers")).toBeInTheDocument()
    await waitFor(() =>
      expect(within(panel).queryByText("Works in a team of five")).not.toBeInTheDocument(),
    )

    await userEvent.click(within(panel).getByRole("button", { name: "Forget everything" }))
    const confirmation = await screen.findByRole("alertdialog")
    await userEvent.click(within(confirmation).getByRole("button", { name: "Forget everything" }))

    expect(await screen.findByText("The agent forgot everything about you.")).toBeInTheDocument()
    expect(Object.values(world.memories).flat()).toEqual([])
  })

  it("shows the card of an MCP App while it loads, in a sandboxed frame", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world, { position: 1 }))

    expect(await screen.findByText("Loading the interactive card…")).toBeInTheDocument()
    const frame = await screen.findByTitle("Interactive card")
    expect(frame).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads",
    )
  })

  it("shows the tool's text instead of an app the API has no HTML for", async () => {
    const world = serveDeskWorld()
    server.use(mockRoute(DeskConversationsRoutes.getMcpAppsHtml, () => []))
    renderApp(conversationUrlOf(world, { position: 1 }))

    expect(
      await screen.findByText("Three releases this month: 2.1, 2.2 and 2.3."),
    ).toBeInTheDocument()
    expect(screen.queryByTitle("Interactive card")).not.toBeInTheDocument()
  })

  it("sends every annotated passage of a reply with the next message", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    const select = (element: HTMLElement, start: number, end: number) => {
      const text = required(element.firstChild, "the text of the passage")
      const range = document.createRange()
      range.setStart(text, start)
      range.setEnd(text, end)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      fireEvent.mouseUp(element)
    }
    const noteBox = () => screen.findByRole("textbox", { name: "Your note on this passage" })

    // A note left for another passage is kept, as one added with Enter.
    select(await screen.findByText(/The Pro plan also adds/), 4, 12)
    await userEvent.type(await noteBox(), "is it billed per seat?")
    select(screen.getByText(/shared workspaces/), 0, 17)
    await userEvent.type(await noteBox(), "how many?{Enter}")

    await userEvent.click(screen.getByRole("button", { name: "Send with 2 annotations" }))

    expect(await screen.findByRole("button", { name: "Send" })).toBeDisabled()
    await waitFor(() =>
      expect(savedMessagesOf(world)).toContainEqual(
        expect.objectContaining({
          role: "user",
          content: "`Pro plan` is it billed per seat?\n`shared workspaces` how many?",
        }),
      ),
    )
  })

  it("reports a problem with a reply", async () => {
    const world = serveDeskWorld()
    renderApp(conversationUrlOf(world))

    // The greeting's button, then the reply's.
    const [, reportButton] = await screen.findAllByRole("button", { name: "Report a problem" })
    await userEvent.click(required(reportButton, "the reply's report button"))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Send the report" }))
    expect(
      await within(dialog).findByText(/Describe the problem in a few words/),
    ).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText("What went wrong?"), "The table is wrong.")
    await userEvent.click(within(dialog).getByRole("button", { name: "Send the report" }))

    expect(await screen.findByText("Thank you. Your report was sent.")).toBeInTheDocument()
    const [, reply] = savedMessagesOf(world).filter((message) => message.role === "assistant")
    expect(world.feedbacks).toEqual([{ agentMessageId: reply?.id, content: "The table is wrong." }])
  })

  it("is not found when its id in the URL is not an id, without asking the API", async () => {
    const world = serveDeskWorld()
    const requests: string[] = []
    server.events.on("request:start", ({ request }) => {
      requests.push(new URL(request.url).pathname)
    })
    renderApp(`${agentUrlOf(world)}/as/not-an-id`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
    expect(requests.some((path) => path.includes("not-an-id"))).toBe(false)
    server.events.removeAllListeners()
  })

  it("does not come back with the browser's back button once deleted", async () => {
    const world = serveDeskWorld()
    const { router } = renderApp(conversationUrlOf(world))

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete the conversation" }))
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    )
    await screen.findByRole("heading", { name: "How can I help you today?" })
    router.history.back()

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })

  it("is not found when it is not the person's", async () => {
    const world = serveDeskWorld()
    renderApp(`${agentUrlOf(world)}/as/${crypto.randomUUID()}`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})

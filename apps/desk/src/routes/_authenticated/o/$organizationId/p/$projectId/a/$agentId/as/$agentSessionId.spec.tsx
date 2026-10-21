import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildDeskWorld, type DeskWorld } from "@/test/factories/desk-world.factory"
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

/** The URL of the main agent, and of one of its conversations, the first by default. */
function urlsOf(world: DeskWorld, conversationIndex = 0) {
  const [assistant] = world.agents
  const conversation = (world.conversations[assistant?.id ?? ""] ?? [])[conversationIndex]
  const agentUrl = `/app/o/${world.organizations[0]?.id}/p/${assistant?.projectId}/a/${assistant?.id}`
  return { agentUrl, conversationUrl: `${agentUrl}/as/${conversation?.id}` }
}

const streamPath =
  "*/api/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/live/:agentSessionId/messages/stream"

describe("a conversation", () => {
  it("shows its messages, without the tool results, and the steps of each reply", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

    expect(await screen.findByText(/Here is a short comparison/)).toBeInTheDocument()
    expect(screen.getByText("Hello! How can I help you today?")).toBeInTheDocument()
    expect(screen.getByText("Used tools")).toBeInTheDocument()
  })

  it("shows the resources a reply points to and the sources it relied on", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    const open = vi.spyOn(window, "open").mockReturnValue({ location: { href: "" } } as Window)
    renderApp(urlsOf(world).conversationUrl)

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
    expect(screen.queryByRole("button", { name: "Open Help center" })).not.toBeInTheDocument()
  })

  it("hides the sources when the project does not show them", async () => {
    const world = buildDeskWorld()
    for (const project of world.projects) project.featureFlags = []
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

    expect(await screen.findByRole("link", { name: /Plan comparison/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Used \d+ sources?/ })).not.toBeInTheDocument()
  })

  it("streams the reply to a message, then lets the person write again", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

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

  it("starts with the first message written on the agent's page", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(urlsOf(world).agentUrl)

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Message to Helpful Assistant" }),
      "Summarize our refund policy{Enter}",
    )

    expect(
      await screen.findByText(/Here is what I found about "Summarize our refund policy"/),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/as\/[0-9a-f-]+$/)
    expect(await screen.findByRole("link", { name: "Summarize our refund policy" })).toBeTruthy()
  })

  it("shows the server's reason when the agent fails, and sends the message again", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    server.use(
      http.get(
        streamPath,
        () =>
          new HttpResponse("event: error\ndata: The model is overloaded\n\n", {
            headers: { "Content-Type": "text/event-stream" },
          }),
        { once: true },
      ),
    )
    renderApp(urlsOf(world).conversationUrl)

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
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    server.use(
      http.get(
        streamPath,
        () =>
          new HttpResponse(
            `data: ${JSON.stringify({ type: "start", messageId: crypto.randomUUID() })}\n\n`,
            { headers: { "Content-Type": "text/event-stream" } },
          ),
        { once: true },
      ),
    )
    renderApp(urlsOf(world).conversationUrl)

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Message to Helpful Assistant" }),
      "Hello{Enter}",
    )

    expect(await screen.findByText("The reply stopped before it finished.")).toBeInTheDocument()
  })

  it("is deleted from the history after a confirmation, and leaves for a new one", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(urlsOf(world).conversationUrl)

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

  it("sends a file with a message, and opens it afterwards", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

    await screen.findByRole("textbox", { name: "Message to Helpful Assistant" })
    const file = new File(["%PDF-1.7"], "invoice.pdf", { type: "application/pdf" })
    await userEvent.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement,
      file,
    )
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
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

    await screen.findByRole("textbox", { name: "Message to Helpful Assistant" })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(["a,b"], "rows.csv", { type: "text/csv" }), {
      applyAccept: false,
    })

    expect(await screen.findByText("Attach a PDF, PNG or JPEG file.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove rows.csv" })).not.toBeInTheDocument()
  })

  it("shows the form the agent fills in", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

    await userEvent.click(await screen.findByRole("button", { name: "Form in progress" }))
    const panel = await screen.findByRole("dialog", { name: "What the agent noted" })

    expect(within(panel).getByText("Team size").nextSibling).toHaveTextContent("5")
    expect(within(panel).getByText("Plan").nextSibling).toHaveTextContent("Pro")
    expect(within(panel).getByText("Start date").nextSibling).toHaveTextContent("—")
  })

  it("asks before the agent remembers a fact, which the person can reword", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

    expect(await screen.findByText("Works in a team of five")).toBeInTheDocument()
    expect(screen.getByText("The agent remembers")).toBeInTheDocument()
    expect(screen.getByText("Should the agent remember this?").nextSibling).toHaveTextContent(
      "Prefers short answers",
    )

    await userEvent.click(screen.getByRole("button", { name: "Reword" }))
    const fact = screen.getByRole("textbox", { name: "The fact to remember" })
    await userEvent.clear(fact)
    await userEvent.type(fact, "Likes short answers")
    await userEvent.click(screen.getByRole("button", { name: "Remember" }))

    expect(await screen.findByText("Likes short answers")).toBeInTheDocument()
    expect(screen.queryByText("Should the agent remember this?")).not.toBeInTheDocument()
  })

  it("forgets what the agent remembers, one fact or all of them", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

    await userEvent.click(await screen.findByRole("button", { name: "Memory (2)" }))
    const panel = await screen.findByRole("dialog", { name: "What the agent remembers" })
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
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world, 1).conversationUrl)

    expect(await screen.findByText("Loading the interactive card…")).toBeInTheDocument()
    const frame = await screen.findByTitle("Interactive card")
    expect(frame).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads",
    )
  })

  it("shows the tool's text instead of an app the API has no HTML for", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    server.use(
      http.post(
        "*/api/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/live/:agentSessionId/messages/mcp-app-html",
        () => HttpResponse.json({ data: [] }, { status: 201 }),
      ),
    )
    renderApp(urlsOf(world, 1).conversationUrl)

    expect(
      await screen.findByText("Three releases this month: 2.1, 2.2 and 2.3."),
    ).toBeInTheDocument()
    expect(screen.queryByTitle("Interactive card")).not.toBeInTheDocument()
  })

  it("reports a problem with a reply", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(urlsOf(world).conversationUrl)

    const [, reportButton] = await screen.findAllByRole("button", { name: "Report a problem" })
    await userEvent.click(reportButton as HTMLElement)
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Send the report" }))
    expect(
      await within(dialog).findByText(/Describe the problem in a few words/),
    ).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText("What went wrong?"), "The table is wrong.")
    await userEvent.click(within(dialog).getByRole("button", { name: "Send the report" }))

    expect(await screen.findByText("Thank you. Your report was sent.")).toBeInTheDocument()
    const [, reply] =
      Object.values(world.messages)[0]?.filter((message) => message.role === "assistant") ?? []
    expect(world.feedbacks).toEqual([{ agentMessageId: reply?.id, content: "The table is wrong." }])
  })

  it("is not found when it is not the person's", async () => {
    const world = buildDeskWorld()
    server.use(...worldHandlers(world))
    renderApp(`${urlsOf(world).agentUrl}/as/${crypto.randomUUID()}`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})

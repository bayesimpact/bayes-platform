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

/** The URL of the main agent, and of its first conversation. */
function urlsOf(world: DeskWorld) {
  const [assistant] = world.agents
  const [conversation] = world.conversations[assistant?.id ?? ""] ?? []
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
    expect(screen.getByText("Worked through 1 step")).toBeInTheDocument()
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

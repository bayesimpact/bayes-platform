import { DeskAgentSessionsRoutes, DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { agentUrlOf, projectUrlOf, routerPathOf } from "@/test/desk-urls"
import {
  buildEmptyHistoryWorld,
  buildExtractionAgentWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/desk-world.factory"
import { hiddenFileInput } from "@/test/file-input"
import { worldHandlers } from "@/test/msw/handlers"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

describe("an agent's pages", () => {
  it("open a new extraction for an extraction agent, with its documents and CSV files", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const agentUrl = agentUrlOf(world)
    const { router } = renderApp(agentUrl)

    expect(
      await screen.findByRole("heading", { name: "What should Document Reader read?" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`${routerPathOf(agentUrl)}/extraction`)
    expect(await screen.findByRole("link", { name: "quarterly-report.pdf" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "meeting-notes.md In progress" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "scanned-manual.pdf Failed" })).toBeInTheDocument()
    // A CSV run takes the name of its file.
    expect(screen.getByRole("link", { name: "articles.csv" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "New extraction" })).toBeInTheDocument()
  })

  it("say so before the first conversation", async () => {
    const world = buildEmptyHistoryWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world))

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument()
  })

  it("keep a history that could not load in the sidebar, with a retry", async () => {
    const world = buildEmptyHistoryWorld()
    server.use(
      mockRoute(DeskAgentSessionsRoutes.getConversations, () => apiError(503), { once: true }),
      ...worldHandlers(world),
    )
    renderApp(agentUrlOf(world))

    expect(await screen.findByText("The history could not load.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "How can I help you today?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument()
  })

  it("keep the first message and its file when the conversation could not start", async () => {
    const world = buildEmptyHistoryWorld()
    server.use(
      mockRoute(DeskConversationsRoutes.createOne, () => apiError(503), { once: true }),
      ...worldHandlers(world),
    )
    const { router } = renderApp(agentUrlOf(world))

    const messageBox = await screen.findByRole("textbox", { name: "Message to Helpful Assistant" })
    await userEvent.upload(
      hiddenFileInput(),
      new File(["%PDF-1.7"], "invoice.pdf", { type: "application/pdf" }),
    )
    await userEvent.type(messageBox, "Read this invoice{Enter}")

    expect(
      await screen.findByText("The conversation could not start. Try again."),
    ).toBeInTheDocument()
    expect(messageBox).toHaveValue("Read this invoice")
    expect(screen.getByRole("button", { name: "Remove invoice.pdf" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(routerPathOf(agentUrlOf(world)))
  })

  it("are not found for an agent the person cannot use", async () => {
    const world = buildEmptyHistoryWorld()
    server.use(...worldHandlers(world))
    renderApp(agentUrlOf(world, "Billing Assistant"))

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })

  it("open a project's URL on its first agent", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    renderApp(projectUrlOf(world, "Pricing"))

    expect(
      await screen.findByRole("combobox", {
        name: "Switch agent, current agent: Pricing Assistant",
      }),
    ).toBeInTheDocument()
  })
})

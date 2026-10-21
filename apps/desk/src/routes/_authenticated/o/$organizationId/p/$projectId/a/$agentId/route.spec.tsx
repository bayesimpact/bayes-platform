import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildEmptyHistoryWorld,
  buildExtractionAgentWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/desk-world.factory"
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

describe("an agent's pages", () => {
  it("open a new extraction for an extraction agent, with its documents and CSV files", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const [reader] = world.agents
    const agentUrl = `/app/o/${world.organizations[0]?.id}/p/${reader?.projectId}/a/${reader?.id}`
    const { router } = renderApp(agentUrl)

    expect(
      await screen.findByRole("heading", { name: "What should Document Reader read?" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`${agentUrl.replace("/app", "")}/extraction`)
    expect(await screen.findByRole("link", { name: "summary.pdf" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "notes.pdf In progress" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Untitled document Failed" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "CSV extraction" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "New extraction" })).toBeInTheDocument()
  })

  it("say so before the first conversation", async () => {
    const world = buildEmptyHistoryWorld()
    server.use(...worldHandlers(world))
    const [assistant] = world.agents
    renderApp(`/app/o/${world.organizations[0]?.id}/p/${assistant?.projectId}/a/${assistant?.id}`)

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument()
  })

  it("keep a history that could not load in the sidebar, with a retry", async () => {
    const world = buildEmptyHistoryWorld()
    server.use(...worldHandlers(world))
    server.use(
      http.post(
        "*/api/organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-agent-sessions/live",
        () => new HttpResponse(null, { status: 503 }),
        { once: true },
      ),
    )
    const [assistant] = world.agents
    renderApp(`/app/o/${world.organizations[0]?.id}/p/${assistant?.projectId}/a/${assistant?.id}`)

    expect(await screen.findByText("The history could not load.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "How can I help you today?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument()
  })

  it("are not found for an agent the person cannot use", async () => {
    const world = buildEmptyHistoryWorld()
    server.use(...worldHandlers(world))
    const billingAssistant = world.agents.find((agent) => agent.name === "Billing Assistant")
    renderApp(
      `/app/o/${world.organizations[0]?.id}/p/${billingAssistant?.projectId}/a/${billingAssistant?.id}`,
    )

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })

  it("open a project's URL on its first agent", async () => {
    const world = buildSeveralProjectsWorld()
    server.use(...worldHandlers(world))
    const pricing = world.projects.find((project) => project.name === "Pricing")
    renderApp(`/app/o/${pricing?.organizationId}/p/${pricing?.id}`)

    expect(
      await screen.findByRole("button", { name: "Switch agent, current agent: Pricing Assistant" }),
    ).toBeInTheDocument()
  })
})

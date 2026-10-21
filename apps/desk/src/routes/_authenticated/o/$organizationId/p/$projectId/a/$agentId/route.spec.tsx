import { screen } from "@testing-library/react"
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

  it("show a past conversation's place until the chat comes", async () => {
    const world = buildEmptyHistoryWorld()
    server.use(...worldHandlers(world))
    const [assistant] = world.agents
    renderApp(
      `/app/o/${world.organizations[0]?.id}/p/${assistant?.projectId}/a/${assistant?.id}/as/${crypto.randomUUID()}`,
    )

    expect(await screen.findByText("Past conversations open soon")).toBeInTheDocument()
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

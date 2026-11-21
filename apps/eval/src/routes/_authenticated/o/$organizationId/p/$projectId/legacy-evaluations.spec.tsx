import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { agentUrlOf, routerPathOf } from "@/test/eval-urls"
import { buildProjectAgent } from "@/test/factories/agents.factory"
import { buildEvalWorld, buildExtractionWorld } from "@/test/factories/eval-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { required } from "@/test/required"

/** The URL of the agent's project, which the former evaluation app named instead of the agent. */
const projectUrlOf = (agentUrl: string) => agentUrl.replace(/\/a\/[^/]+$/, "")

describe("the URLs of the former evaluation app", () => {
  it("open the datasets of the project under its conversation agent", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const agentUrl = agentUrlOf(world)
    const { router } = renderApp(`${projectUrlOf(agentUrl)}/conversation`)

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${routerPathOf(agentUrl)}/evaluations`),
    )
    expect(await screen.findAllByRole("link", { name: "Pricing questions" })).not.toHaveLength(0)
  })

  it("open a dataset, then one of its runs, under the agent", async () => {
    const world = buildEvalWorld()
    const { run } = required(
      world.conversationRuns.find((candidate) => candidate.run.status === "completed"),
      "a completed run",
    )
    server.use(...worldHandlers(world))
    const agentUrl = agentUrlOf(world)
    const datasetPath = `${routerPathOf(agentUrl)}/evaluations/${run.evaluationConversationDatasetId}`
    const { router } = renderApp(
      `${projectUrlOf(agentUrl)}/conversation/${run.evaluationConversationDatasetId}`,
    )
    await waitFor(() => expect(router.state.location.pathname).toBe(datasetPath))

    await router.navigate({
      href: `${routerPathOf(projectUrlOf(agentUrl))}/conversation/${run.evaluationConversationDatasetId}/runs/${run.id}`,
    })
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${datasetPath}/runs/${run.id}`),
    )
  })

  it("keep the runs of a comparison", async () => {
    const world = buildEvalWorld()
    const runs = world.conversationRuns
      .filter((candidate) => candidate.run.status === "completed")
      .map((candidate) => candidate.run)
    const [first, second] = runs
    const picked = `${required(first, "a run").id},${required(second, "another run").id}`
    server.use(...worldHandlers(world))
    const agentUrl = agentUrlOf(world)
    const { router } = renderApp(
      `${projectUrlOf(agentUrl)}/conversation/${required(first, "a run").evaluationConversationDatasetId}/compare?runs=${picked}`,
    )

    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/compare$/))
    expect(router.state.location.search).toMatchObject({ runs: picked })
    expect(await screen.findByRole("heading", { name: "Compare runs" })).toBeInTheDocument()
  })

  it("open a comparison under the agent its runs asked", async () => {
    const world = buildEvalWorld()
    const runs = world.conversationRuns
      .filter((candidate) => candidate.run.status === "completed")
      .map((candidate) => candidate.run)
    const [first, second] = runs
    const firstRun = required(first, "a run")
    const secondRun = required(second, "another run")
    const firstAgentUrl = agentUrlOf(world)
    const firstAgent = required(
      world.agents.find((agent) => firstAgentUrl.endsWith(agent.id)),
      "the first agent",
    )
    const project = required(
      world.projects.find((candidate) => candidate.id === firstAgent.projectId),
      "the project of the first agent",
    )
    // Another conversation agent of the project, which the compared runs asked.
    const otherAgent = buildProjectAgent(project, { name: "Pricing Helper" })
    world.agents.push(otherAgent)
    firstRun.agentId = otherAgent.id
    secondRun.agentId = otherAgent.id
    server.use(...worldHandlers(world))
    const picked = `${firstRun.id},${secondRun.id}`
    const { router } = renderApp(
      `${projectUrlOf(firstAgentUrl)}/conversation/${firstRun.evaluationConversationDatasetId}/compare?runs=${picked}`,
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${routerPathOf(agentUrlOf(world, "Pricing Helper"))}/evaluations/${firstRun.evaluationConversationDatasetId}/compare`,
      ),
    )
  })

  it("open the datasets of an extraction agent from an extraction URL", async () => {
    const world = buildExtractionWorld()
    server.use(...worldHandlers(world))
    const agentUrl = agentUrlOf(world)
    const { router } = renderApp(`${projectUrlOf(agentUrl)}/extraction`)

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${routerPathOf(agentUrl)}/evaluations`),
    )
  })
})

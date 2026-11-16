import { describe, expect, it } from "vitest"
import {
  chooseDefaultAgent,
  flattenEvaluationAgents,
  groupEvaluationAgents,
} from "./evaluation-agents"
import type { EvaluationProject } from "./evaluation-projects"

const organization = { id: crypto.randomUUID(), name: "Product" }
const pricing: EvaluationProject = { id: crypto.randomUUID(), name: "Pricing", organization }
const support: EvaluationProject = { id: crypto.randomUUID(), name: "Support", organization }

const agent = (name: string, project: EvaluationProject) => ({
  id: crypto.randomUUID(),
  name,
  type: "conversation" as const,
  projectId: project.id,
})

describe("groupEvaluationAgents", () => {
  it("keeps the projects' order and leaves out the projects with no agent", () => {
    const groups = groupEvaluationAgents(
      [pricing, support],
      [[], [agent("Helpful Assistant", support), agent("Writing Helper", support)]],
    )

    expect(groups.map((group) => group.project.name)).toEqual(["Support"])
    expect(flattenEvaluationAgents(groups).map((evaluationAgent) => evaluationAgent.name)).toEqual([
      "Helpful Assistant",
      "Writing Helper",
    ])
  })
})

describe("chooseDefaultAgent", () => {
  const groups = groupEvaluationAgents(
    [pricing, support],
    [[agent("Pricing Assistant", pricing)], [agent("Helpful Assistant", support)]],
  )
  const agents = flattenEvaluationAgents(groups)

  it("opens the last agent the person opened", () => {
    expect(chooseDefaultAgent(agents, agents[1]?.id ?? null)?.name).toBe("Helpful Assistant")
  })

  it("opens the first agent when the last one is gone or unknown", () => {
    expect(chooseDefaultAgent(agents, crypto.randomUUID())?.name).toBe("Pricing Assistant")
    expect(chooseDefaultAgent(agents, null)?.name).toBe("Pricing Assistant")
  })

  it("opens nothing when the person has no agent", () => {
    expect(chooseDefaultAgent([], null)).toBeNull()
  })
})

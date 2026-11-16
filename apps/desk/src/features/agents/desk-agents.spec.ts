import {
  AGENT_SESSION_CREATE_PERMISSIONS,
  type ProjectAgentOutputDto,
} from "@caseai-connect/desk-contracts"
import { describe, expect, it } from "vitest"
import { chooseDefaultAgent, flattenDeskAgents, groupDeskAgents } from "./desk-agents"
import type { DeskProject } from "./desk-projects"

const organization = { id: crypto.randomUUID(), name: "Product" }
const pricing: DeskProject = {
  id: crypto.randomUUID(),
  name: "Pricing",
  featureFlags: [],
  organization,
}
const support: DeskProject = {
  id: crypto.randomUUID(),
  name: "Support",
  featureFlags: [],
  organization,
}

const agent = (
  name: string,
  project: DeskProject,
  greetingMessage?: string,
): ProjectAgentOutputDto => ({
  id: crypto.randomUUID(),
  name,
  type: "conversation",
  projectId: project.id,
  currentRevision: greetingMessage === undefined ? {} : { greetingMessage },
  permissions: [AGENT_SESSION_CREATE_PERMISSIONS.conversation],
})

describe("groupDeskAgents", () => {
  it("keeps the projects' order and leaves out the projects with no agent", () => {
    const groups = groupDeskAgents(
      [pricing, support],
      [[], [agent("Helpful Assistant", support), agent("Writing Helper", support)]],
    )

    expect(groups.map((group) => group.project.name)).toEqual(["Support"])
    expect(flattenDeskAgents(groups).map((deskAgent) => deskAgent.name)).toEqual([
      "Helpful Assistant",
      "Writing Helper",
    ])
  })

  it("leaves out the agents the person may read but not open a session with", () => {
    const groups = groupDeskAgents(
      [pricing, support],
      [
        // A project evaluator reads every agent of the project, with no key to start a session.
        [{ ...agent("Pricing Assistant", pricing), permissions: [] }],
        [
          agent("Helpful Assistant", support),
          // The key of another type of agent does not open this one.
          {
            ...agent("Document Reader", support),
            type: "extraction",
            permissions: [AGENT_SESSION_CREATE_PERMISSIONS.conversation],
          },
          {
            ...agent("Form Reader", support),
            type: "extraction",
            permissions: ["agent.update", AGENT_SESSION_CREATE_PERMISSIONS.extraction],
          },
        ],
      ],
    )

    expect(groups.map((group) => group.project.name)).toEqual(["Support"])
    expect(flattenDeskAgents(groups).map((deskAgent) => deskAgent.name)).toEqual([
      "Helpful Assistant",
      "Form Reader",
    ])
  })

  it("keeps the greeting of each agent, and none for a blank one", () => {
    const groups = groupDeskAgents(
      [support],
      [
        [
          agent("Helpful Assistant", support, "Hello! How can I help you today?"),
          agent("Writing Helper", support, "  "),
          agent("Pricing Assistant", support),
        ],
      ],
    )

    expect(flattenDeskAgents(groups).map((deskAgent) => deskAgent.greetingMessage)).toEqual([
      "Hello! How can I help you today?",
      null,
      null,
    ])
  })
})

describe("chooseDefaultAgent", () => {
  const groups = groupDeskAgents(
    [pricing, support],
    [[agent("Pricing Assistant", pricing)], [agent("Helpful Assistant", support)]],
  )
  const agents = flattenDeskAgents(groups)

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

import { describe, expect, it } from "@jest/globals"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import {
  type ActiveTurnAgent,
  CHILD_FIRST_TURN_TRIGGER,
  MAX_HANDOFF_TURNS,
  PARENT_RESUME_TRIGGER,
  runHandoffTurns,
} from "./handoff-turn-loop"

const agent = (id: string) => ({ id, name: id }) as Agent
const settings = { id: "settings" } as AgentSettings
const root: ActiveTurnAgent = { agent: agent("root"), agentSettings: settings }
const child: ActiveTurnAgent = {
  agent: agent("child"),
  agentSettings: settings,
  handoff: { parentAgent: root.agent },
}

type Ran = { agentId: string; userContent: string; persistUserMessage: boolean }

/** Runs the loop against a scripted sequence of active agents (one entry per resolution). */
async function run(sequence: ActiveTurnAgent[]) {
  const ran: Ran[] = []
  const events: string[] = []
  let resolutions = 0
  const generator = runHandoffTurns<string>({
    userContent: "hello",
    resolveActiveAgent: async () => {
      const next = sequence[Math.min(resolutions, sequence.length - 1)]
      resolutions += 1
      if (!next) throw new Error("no agent scripted")
      return next
    },
    runTurn: async function* ({ active, userContent, persistUserMessage }) {
      ran.push({ agentId: active.agent.id, userContent, persistUserMessage })
      yield `${active.agent.id}:reply`
    },
  })
  for await (const event of generator) events.push(event)
  return { ran, events }
}

describe("runHandoffTurns", () => {
  it("runs one turn when the active agent does not change", async () => {
    const { ran, events } = await run([root, root])
    expect(ran).toEqual([{ agentId: "root", userContent: "hello", persistUserMessage: true }])
    expect(events).toEqual(["root:reply"])
  })

  it("runs the child's first turn right after a hand-over, with a trigger that is not stored", async () => {
    const { ran } = await run([root, child, child])
    expect(ran).toEqual([
      { agentId: "root", userContent: "hello", persistUserMessage: true },
      { agentId: "child", userContent: CHILD_FIRST_TURN_TRIGGER, persistUserMessage: false },
    ])
  })

  it("sends the user's message to the child when a handoff is in progress", async () => {
    const { ran } = await run([child, child])
    expect(ran).toEqual([{ agentId: "child", userContent: "hello", persistUserMessage: true }])
  })

  it("resumes the parent after the child concludes", async () => {
    const { ran, events } = await run([child, root, root])
    expect(ran).toEqual([
      { agentId: "child", userContent: "hello", persistUserMessage: true },
      { agentId: "root", userContent: PARENT_RESUME_TRIGGER, persistUserMessage: false },
    ])
    expect(events).toEqual(["child:reply", "root:reply"])
  })

  it("stops after the cap when agents keep handing the conversation to each other", async () => {
    const other: ActiveTurnAgent = {
      agent: agent("other"),
      agentSettings: settings,
      handoff: { parentAgent: root.agent },
    }
    const endless = Array.from({ length: 20 }, (_, index) => (index % 2 === 0 ? child : other))
    const { ran } = await run(endless)
    expect(ran).toHaveLength(MAX_HANDOFF_TURNS)
  })
})

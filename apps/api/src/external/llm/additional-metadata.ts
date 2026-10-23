import type { AdditionalMetadata } from "@/common/interfaces/llm-provider.interface"
import { removeNullish } from "@/common/utils/remove-nullish"

/** The agent of a call as its traces name it: an agent entity, its settings, or a fixed type. */
type AgentDescription = { name?: string; type?: string }
type AgentRevision = { revision: number }

/**
 * The metadata a caller adds to its LLM calls, under `agent.*`, `run.*`, `test.*` and
 * `environment`. A call that serves a tool adds `tool` on top of its caller's metadata.
 */
export function buildAdditionalMetadata({
  agent,
  agentSettings,
  model,
  agentClass,
  parent,
  runTag,
  test,
  environment,
}: {
  agent?: AgentDescription
  agentSettings?: AgentRevision
  /** The model the agent runs on, set by the live regressions that run without settings. */
  model?: string
  /** Set on a run that calls sub-agents, and on the sub-agent runs. */
  agentClass?: "parent-agent" | "sub-agent"
  /** The agent that called this sub-agent, and the trace of its run. */
  parent?: { agent: AgentDescription; agentSettings: AgentRevision; trace: string }
  /** The batch job an extraction runs for, e.g. "agent-csv-extraction-run". */
  runTag?: string
  test?: { name: string; case: string }
  environment?: string
}): AdditionalMetadata {
  return removeNullish({
    agent: removeNullish({
      name: agent?.name,
      revision: agentSettings?.revision,
      type: agent?.type,
      class: agentClass,
      model,
      parent: parent && {
        name: parent.agent.name,
        revision: parent.agentSettings.revision,
        type: parent.agent.type,
        trace: parent.trace,
      },
    }),
    run: runTag ? { tag: runTag } : undefined,
    test,
    environment,
  })
}

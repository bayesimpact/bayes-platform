type ValidFeatureFlagKey<Key extends string> = Key extends `${string}_${string}` ? never : Key

function featureFlag<Key extends string>(flag: {
  key: ValidFeatureFlagKey<Key>
  description: string
}) {
  return flag
}

export const FeatureFlags = [
  featureFlag({
    key: "evaluation",
    description:
      "Evaluate the performance of your agents with a set of pre-defined evaluation tasks",
  }),
  featureFlag({
    key: "sources-tool",
    description: "Access and utilize the sources tool.",
  }),
  featureFlag({
    key: "gemma",
    description: "Access and utilize gemma models.",
  }),
  featureFlag({
    key: "medgemma",
    description: "Access and utilize medgemma models.",
  }),
  featureFlag({
    key: "mistral",
    description: "(tests purpose only) Access and utilize mistral models.",
  }),
  featureFlag({
    key: "qwen",
    description: "Access and utilize qwen models.",
  }),
  featureFlag({
    key: "llm-priority-calls",
    description: "Access and set priority for Gemini 3.x models",
  }),
  featureFlag({
    key: "llm-flex-workers",
    description: "Use flex in worker's calls for Gemini 3.x models",
  }),
  featureFlag({
    key: "project-analytics",
    description: "View project-level analytics and usage charts in the studio.",
  }),
  featureFlag({
    key: "agent-mcp",
    description: "Connect MCP servers to agents for external tool access.",
  }),
  featureFlag({
    key: "agent-embed",
    description: "Embed conversation agents as a chat widget on external websites.",
  }),
  featureFlag({
    key: "agent-orchestration",
    description: "Compose conversation agents with sub-agents.",
  }),
  featureFlag({
    key: "agent-memory",
    description: "Let conversation agents remember facts about signed-in users.",
  }),
  featureFlag({
    key: "agent-prompt-variables",
    description:
      "Collect values for the variables an agent declares in its instructions, at session start, with defaults set on the agent's settings.",
  }),
  featureFlag({
    key: "chat-interface-prompt",
    description:
      "Tell conversation agents how the Desk shows their task lists, and what the quoted passages and ticked tasks in the user's messages mean.",
  }),
  featureFlag({
    key: "local-embeddings",
    description:
      "(beta) Embed project documents with local HuggingFace models (bge-m3, EmbeddingGemma) and pick the retrieval model per agent.",
  }),
] as const
export type FeatureFlagKey = (typeof FeatureFlags)[number]["key"]
export type FeatureFlagsDto = FeatureFlagKey[]

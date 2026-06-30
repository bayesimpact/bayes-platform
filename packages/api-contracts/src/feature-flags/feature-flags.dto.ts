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
    key: "project-analytics",
    description: "View project-level analytics and usage charts in the studio.",
  }),
  featureFlag({
    key: "web-sources",
    description: "Crawl a website and index its pages as documents.",
  }),
  featureFlag({
    key: "agent-embed",
    description: "Embed conversation agents as a chat widget on external websites.",
  }),
  featureFlag({
    key: "agent-orchestration",
    description: "Compose conversation agents with sub-agents.",
  }),
] as const
export type FeatureFlagKey = (typeof FeatureFlags)[number]["key"]
export type FeatureFlagsDto = FeatureFlagKey[]

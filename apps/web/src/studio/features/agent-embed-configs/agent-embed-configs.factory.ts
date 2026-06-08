import type { EmbedDisplayMode } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { AgentEmbedConfig } from "./agent-embed-configs.models"

type AgentEmbedConfigTransientParams = {
  agent: Agent
}

class AgentEmbedConfigFactory extends Factory<AgentEmbedConfig, AgentEmbedConfigTransientParams> {}

export const agentEmbedConfigFactory = AgentEmbedConfigFactory.define(
  ({ params, transientParams }) => {
    const { agent } = transientParams
    if (!agent) {
      throw new Error("Agent must be provided in transient params to build an AgentEmbedConfig")
    }

    return {
      id: params.id ?? faker.string.uuid(),
      agentId: agent.id,
      embedToken: params.embedToken ?? faker.string.uuid(),
      isEnabled: params.isEnabled ?? false,
      allowedOrigins: params.allowedOrigins ?? [],
      title: params.title ?? null,
      logoUrl: params.logoUrl ?? null,
      primaryColor: params.primaryColor ?? null,
      displayMode: (params.displayMode ?? "modal") as EmbedDisplayMode,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)

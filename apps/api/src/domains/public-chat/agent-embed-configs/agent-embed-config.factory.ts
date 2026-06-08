import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Agent } from "@/domains/agents/agent.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { AgentEmbedConfig } from "./agent-embed-config.entity"

type AgentEmbedConfigTransientParams = {
  organization: Organization
  project: Project
  agent: Agent
}

class AgentEmbedConfigFactory extends Factory<AgentEmbedConfig, AgentEmbedConfigTransientParams> {}

const now = new Date()

export const agentEmbedConfigFactory = AgentEmbedConfigFactory.define(
  ({ params, transientParams }) => {
    return {
      id: params.id ?? randomUUID(),
      agentId: transientParams.agent?.id ?? params.agentId ?? randomUUID(),
      organizationId: transientParams.organization?.id ?? params.organizationId ?? randomUUID(),
      projectId: transientParams.project?.id ?? params.projectId ?? randomUUID(),
      embedToken: params.embedToken ?? randomUUID(),
      isEnabled: params.isEnabled ?? true,
      allowedOrigins: params.allowedOrigins ?? [],
      title: params.title ?? null,
      logoUrl: params.logoUrl ?? null,
      primaryColor: params.primaryColor ?? null,
      displayMode: params.displayMode ?? "modal",
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
      deletedAt: params.deletedAt ?? null,
      agent: transientParams.agent ?? (params.agent as Agent),
    } satisfies AgentEmbedConfig
  },
)

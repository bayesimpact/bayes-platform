import crypto, { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { AgentEmbedConfig } from "../agent-embed-configs/agent-embed-config.entity"
import type { PublicAgentSession } from "./public-agent-session.entity"

type PublicAgentSessionTransientParams = {
  embedConfig: AgentEmbedConfig
  /** Plaintext session token — will be hashed and stored in sessionTokenHash */
  sessionToken?: string
}

class PublicAgentSessionFactory extends Factory<
  PublicAgentSession,
  PublicAgentSessionTransientParams
> {}

const now = new Date()

export const publicAgentSessionFactory = PublicAgentSessionFactory.define(
  ({ params, transientParams }) => {
    const sessionToken = transientParams.sessionToken ?? randomUUID()
    const sessionTokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

    return {
      id: params.id ?? randomUUID(),
      embedConfigId: transientParams.embedConfig?.id ?? params.embedConfigId ?? randomUUID(),
      agentId: transientParams.embedConfig?.agentId ?? params.agentId ?? randomUUID(),
      organizationId:
        transientParams.embedConfig?.organizationId ?? params.organizationId ?? randomUUID(),
      projectId: transientParams.embedConfig?.projectId ?? params.projectId ?? randomUUID(),
      sessionTokenHash: params.sessionTokenHash ?? sessionTokenHash,
      externalVisitorId: params.externalVisitorId ?? null,
      lastActivityAt: params.lastActivityAt ?? now,
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
      deletedAt: params.deletedAt ?? null,
      embedConfig: transientParams.embedConfig ?? (params.embedConfig as AgentEmbedConfig),
    } satisfies PublicAgentSession
  },
)

import crypto, { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Agent } from "@/domains/agents/agent.entity"
import type { PublicAgentSession } from "./public-agent-session.entity"

type PublicAgentSessionTransientParams = {
  agent: Agent
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
      agentId: transientParams.agent?.id ?? params.agentId ?? randomUUID(),
      organizationId:
        transientParams.agent?.organizationId ?? params.organizationId ?? randomUUID(),
      projectId: transientParams.agent?.projectId ?? params.projectId ?? randomUUID(),
      sessionTokenHash: params.sessionTokenHash ?? sessionTokenHash,
      externalVisitorId: params.externalVisitorId ?? null,
      lastActivityAt: params.lastActivityAt ?? now,
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
      deletedAt: params.deletedAt ?? null,
      agent: transientParams.agent ?? (params.agent as Agent),
    } satisfies PublicAgentSession
  },
)

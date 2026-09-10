import { randomUUID } from "node:crypto"
import type { AllRepositories } from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import type { AgentEmbedConfig } from "./agent-embed-configs/agent-embed-config.entity"
import { agentEmbedConfigFactory } from "./agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "./public-agent-sessions/public-agent-session.factory"

/**
 * Seeds what a public chat e2e test needs: an organization with a published agent, an
 * enabled embed configuration on it and one session with a known clear token.
 */
export async function createEmbedConfigWithSession(
  repositories: AllRepositories,
  embedConfigOverrides: Partial<AgentEmbedConfig> = {},
) {
  const { organization, project, agent, agentSettings } =
    await createOrganizationWithAgent(repositories)
  const embedConfig = agentEmbedConfigFactory
    .transient({ organization, project, agent })
    .build({ isEnabled: true, ...embedConfigOverrides })
  await repositories.agentEmbedConfigRepository.save(embedConfig)

  const sessionToken = randomUUID()
  const session = publicAgentSessionFactory.transient({ embedConfig, sessionToken }).build()
  await repositories.publicAgentSessionRepository.save(session)

  return { organization, project, agent, agentSettings, embedConfig, session, sessionToken }
}

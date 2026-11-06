import { Injectable, Logger } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsService } from "@/domains/agents/agents.service"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import type { ActiveTurnAgent } from "./handoff-turn-loop"

/**
 * The agent relations the tools builder reads (the MCP servers are queried on
 * their own). Every path that loads an agent to answer a turn loads these:
 * without `documentTags`, an agent in tag RAG mode searches every document.
 */
export const TURN_AGENT_RELATIONS = ["documentTags", "sessionCategories", "resourceLibraries"]

/**
 * Who answers the next turn of a session. The session's own agent unless a
 * handoff is in progress, in which case the sub-agent recorded as the active
 * agent answers, with its latest published settings: the playground's version
 * picker applies to the agent under test, not to the sub-agent it hands the
 * conversation to. Falls back to the session's agent when the recorded agent
 * no longer exists in the project, or has no published version left.
 */
@Injectable()
export class ActiveAgentScopeService {
  private readonly logger = new Logger(ActiveAgentScopeService.name)

  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  async resolve({
    connectScope,
    rootAgent,
    rootAgentSettings,
    activeAgentId,
  }: {
    connectScope: RequiredConnectScope
    rootAgent: Agent
    rootAgentSettings: AgentSettings
    activeAgentId: string | null
  }): Promise<ActiveTurnAgent> {
    if (!activeAgentId || activeAgentId === rootAgent.id) {
      return { agent: rootAgent, agentSettings: rootAgentSettings }
    }

    const activeAgent = await this.agentsService.findAgentById({
      connectScope,
      agentId: activeAgentId,
      relations: TURN_AGENT_RELATIONS,
    })
    if (!activeAgent || activeAgent.type !== "conversation") {
      this.logger.warn(
        `Active agent ${activeAgentId} not found for agent ${rootAgent.id}; the session's agent answers`,
      )
      return { agent: rootAgent, agentSettings: rootAgentSettings }
    }

    const agentSettings = await this.agentSettingsService.findLastPublished({
      connectScope,
      agentId: activeAgent.id,
    })
    if (!agentSettings) {
      this.logger.warn(
        `Active agent ${activeAgentId} has no published version for agent ${rootAgent.id}; the session's agent answers`,
      )
      return { agent: rootAgent, agentSettings: rootAgentSettings }
    }
    return { agent: activeAgent, agentSettings, handoff: { parentAgent: rootAgent } }
  }
}

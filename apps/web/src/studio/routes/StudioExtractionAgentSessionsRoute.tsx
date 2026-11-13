import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useCurrentId } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { ExtractionAgentSessionsRoute } from "@/common/routes/agents/ExtractionAgentSessionsRoute"
import { useAppSelector } from "@/common/store/hooks"
import { ExtractionAgentSessionList } from "@/studio/features/agents/components/AgentSessionList"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"

/**
 * The studio page of an extraction agent. For agent managers it embeds the agent editor, which
 * reads the project's MCP servers. The project mount lists them, and a deep link can arrive
 * first. Other roles do not see the editor, and some cannot read that list: they do not wait.
 */
export function StudioExtractionAgentSessionsRoute() {
  const agentId = useCurrentId(selectCurrentAgentId)
  const { abilities } = useAbility()
  const mcpServers = useAppSelector(selectMcpServersData)
  const editorData = abilities.canManageAgent({ agentId }) ? [mcpServers] : []

  return (
    <ExtractionAgentSessionsRoute>
      <AsyncRoute data={editorData}>
        <ExtractionAgentSessionList />
      </AsyncRoute>
    </ExtractionAgentSessionsRoute>
  )
}

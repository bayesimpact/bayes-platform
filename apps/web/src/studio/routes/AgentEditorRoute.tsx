import { DOCUMENT_READ_PERMISSION } from "@caseai-connect/api-contracts"
import { useNavigate, useSearchParams } from "react-router-dom"
import { agentSettingsActions } from "@/common/features/agents/agent-settings/agent-settings.slice"
import {
  selectAgentsData,
  selectAvailableModelsData,
  selectCurrentAgentData,
} from "@/common/features/agents/agents.selectors"
import { agentsActions } from "@/common/features/agents/agents.slice"
import { DeprecatedModelBanner } from "@/common/features/agents/components/DeprecatedModelBanner"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { selectAgentSubAgentsData } from "@/studio/features/agent-sub-agents/agent-sub-agents.selectors"
import { agentSubAgentsActions } from "@/studio/features/agent-sub-agents/agent-sub-agents.slice"
import {
  AgentEditor,
  type AgentEditorOrchestration,
  agentEditorTabKeys,
  type TabKey,
} from "@/studio/features/agents/components/AgentEditor"
import { selectMcpServersData } from "@/studio/features/mcp-servers/mcp-servers.selectors"
import { projectEmbeddingModelsActions } from "@/studio/features/project-embedding-models/project-embedding-models.slice"
import { selectAgentSettingsDataByAgentId } from "../../common/features/agents/agent-settings/agent-settings.selectors"

/**
 * The agent editor, as a page of its own. It sits outside the Studio layout: the editor's menu
 * takes the place of the Studio sidebar. So it loads what that layout and the agent pages load
 * for their own screens: the project's model catalog and the agent's settings.
 */
export function AgentEditorRoute() {
  const agent = useValue(selectCurrentAgentData)
  const project = useValue(selectCurrentProjectData)
  const subAgents = useAppSelector(selectAgentSubAgentsData)
  const agentModels = useAppSelector(selectAvailableModelsData)
  // The project mount lists the MCP servers, and the editor reads them: a deep link can arrive first.
  const mcpServers = useAppSelector(selectMcpServersData)
  const agentSettings = useAppSelector(
    selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true }),
  )
  const hasOrchestration =
    agent.type === "conversation" && project.featureFlags.includes("agent-orchestration")

  useMount({
    actions: {
      mount: agentsActions.mountAvailableModels,
      unmount: agentsActions.unmountAvailableModels,
    },
    refreshOn: [project.id],
  })
  useMount({ actions: agentSettingsActions, refreshOn: [agent.id] })
  useMount({ actions: agentSubAgentsActions, condition: hasOrchestration })
  // Listing the project's embedding models needs the right to see its documents.
  useMount({
    actions: projectEmbeddingModelsActions,
    condition:
      project.featureFlags.includes("embedding-models") &&
      project.permissions.includes(DOCUMENT_READ_PERMISSION),
  })

  if (hasOrchestration) {
    return (
      <AsyncRoute data={[agentSettings, agentModels, subAgents, mcpServers]}>
        <WithOrchestrationData />
      </AsyncRoute>
    )
  }

  return (
    <AsyncRoute data={[agentSettings, agentModels, mcpServers]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithOrchestrationData() {
  const agents = useValue(selectAgentsData)
  const subAgents = useValue(selectAgentSubAgentsData)
  return <WithData orchestration={{ agents, subAgents }} />
}

function WithData({ orchestration }: { orchestration?: AgentEditorOrchestration }) {
  const agent = useValue(selectCurrentAgentData)
  const agentSettings = useValue(
    selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true }),
  )
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()

  // Optional deep link: ?tab=embed opens the editor on that section (falls back to "general").
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get("tab")
  const defaultTab = agentEditorTabKeys.includes(tabParam as TabKey)
    ? (tabParam as TabKey)
    : undefined

  return (
    <AgentEditor
      key={agent.id}
      layout="page"
      agent={agent}
      agentSettings={agentSettings}
      orchestration={orchestration}
      defaultTab={defaultTab}
      onBack={() => navigate(agentRoute)}
      banner={<DeprecatedModelBanner model={agentSettings.model} />}
    />
  )
}

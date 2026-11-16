import { DOCUMENT_READ_PERMISSION } from "@caseai-connect/api-contracts"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Grid, GridHeader } from "@/common/components/grid/Grid"
import { selectAgentsData, selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
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
import { AgentProductionBar } from "../features/agents/agent-settings/components/AgentProductionBar"

export function AgentEditorRoute() {
  const agent = useValue(selectCurrentAgentData)
  const project = useValue(selectCurrentProjectData)
  const subAgents = useAppSelector(selectAgentSubAgentsData)
  // The project mount lists the MCP servers, and the editor reads them: a deep link can arrive first.
  const mcpServers = useAppSelector(selectMcpServersData)
  const agentSettings = useAppSelector(
    selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true }),
  )
  const hasOrchestration =
    agent.type === "conversation" && project.featureFlags.includes("agent-orchestration")

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
      <AsyncRoute data={[agentSettings, subAgents, mcpServers]}>
        <WithOrchestrationData />
      </AsyncRoute>
    )
  }

  return (
    <AsyncRoute data={[agentSettings, mcpServers]}>
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()
  const handleBack = () => navigate(agentRoute)

  // Optional deep link: ?tab=embed opens the editor on that tab (falls back to "general").
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get("tab")
  const defaultTab = agentEditorTabKeys.includes(tabParam as TabKey)
    ? (tabParam as TabKey)
    : undefined

  return (
    <Grid cols={0}>
      <GridHeader
        onBack={handleBack}
        title={t(`agent:update.${agent.type}.title`)}
        description={t(`agent:update.${agent.type}.description`)}
      />

      <AgentProductionBar agent={agent} agentSettings={agentSettings} />

      <AgentEditor
        key={agent.id}
        agent={agent}
        agentSettings={agentSettings}
        className="bg-white p-6"
        orchestration={orchestration}
        defaultTab={defaultTab}
        showVersionActions
      />
    </Grid>
  )
}

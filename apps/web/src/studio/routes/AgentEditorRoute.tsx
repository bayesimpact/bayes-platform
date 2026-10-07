import { ButtonGroup } from "@caseai-connect/ui/shad/button-group"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
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
} from "@/studio/features/agents/components/AgentEditor"
import { projectEmbeddingModelsActions } from "@/studio/features/project-embedding-models/project-embedding-models.slice"
import { selectAgentSettingsDataByAgentId } from "../../common/features/agents/agent-settings/agent-settings.selectors"
import { AgentSettingsCreateButton } from "../features/agents/agent-settings/components/AgentSettingsCreateButton"
import { AgentSettingsHistory } from "../features/agents/agent-settings/components/AgentSettingsHistory"

export function AgentEditorRoute() {
  const agent = useValue(selectCurrentAgentData)
  const project = useValue(selectCurrentProjectData)
  const subAgents = useAppSelector(selectAgentSubAgentsData)
  const agentSettings = useAppSelector(
    selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true }),
  )
  const hasOrchestration =
    agent.type === "conversation" && project.featureFlags.includes("agent-orchestration")

  useMount({ actions: agentSubAgentsActions, condition: hasOrchestration })
  useMount({
    actions: projectEmbeddingModelsActions,
    condition: project.featureFlags.includes("local-embeddings"),
  })

  if (hasOrchestration) {
    return (
      <AsyncRoute data={[agentSettings, subAgents]}>
        <WithOrchestrationData />
      </AsyncRoute>
    )
  }

  return (
    <AsyncRoute data={[agentSettings]}>
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
  const [editorDirty, setEditorDirty] = useState(false)

  return (
    <Grid cols={0}>
      <GridHeader
        onBack={handleBack}
        title={t(`agent:update.${agent.type}.title`)}
        description={t(`agent:update.${agent.type}.description`)}
        action={
          <ButtonGroup>
            <AgentSettingsHistory agent={agent} agentSettings={agentSettings} />
            <AgentSettingsCreateButton
              agentSettings={agentSettings}
              hasUnsavedChanges={editorDirty}
            />
          </ButtonGroup>
        }
      />

      <AgentEditor
        key={agent.id}
        agent={agent}
        agentSettings={agentSettings}
        className="bg-white p-6"
        orchestration={orchestration}
        onDirtyChange={setEditorDirty}
      />
    </Grid>
  )
}

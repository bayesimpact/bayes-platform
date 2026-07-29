import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridHeader } from "@/common/components/grid/Grid"
import { selectAgentsData, selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import {
  selectAgentSettingsData,
  selectLastAgentSettings,
} from "@/common/features/agents/settings/agent-settings.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { selectAgentSubAgentsData } from "@/studio/features/agent-sub-agents/agent-sub-agents.selectors"
import { agentSubAgentsActions } from "@/studio/features/agent-sub-agents/agent-sub-agents.slice"
import {
  AgentEditor,
  type AgentEditorOrchestration,
} from "@/studio/features/agents/components/AgentEditor"

export function AgentEditorRoute() {
  const agent = useValue(selectCurrentAgentData)
  const project = useValue(selectCurrentProjectData)
  const subAgents = useAppSelector(selectAgentSubAgentsData)
  const agentSettings = useAppSelector(selectAgentSettingsData)
  const hasOrchestration =
    agent.type === "conversation" && project.featureFlags.includes("agent-orchestration")

  useMount({ actions: agentSubAgentsActions, condition: hasOrchestration })

  if (hasOrchestration) {
    return (
      <AsyncRoute data={[subAgents, agentSettings]}>
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
  // `agentSettings` is a single-slot store: `AsyncRoute` above only guarantees *some* agent's
  // revisions are fulfilled, not this agent's. While switching from one agent's editor to
  // another's, the slot can still hold the previous agent's fulfilled revisions for one render;
  // gate on the agentId carried by the revision itself and fall back to the loading state until
  // the slot catches up with the current agent.
  const settings = useAppSelector(selectLastAgentSettings)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()
  const handleBack = () => navigate(agentRoute)

  // `selectLastAgentSettings` only returns null when the revision list is empty, which the API
  // forbids (revision 1 always exists on creation) - this is a defensive guard, not an
  // expected runtime path.
  if (!settings) return <ErrorRoute error="Agent settings not found" />
  if (settings.agentId !== agent.id) return <LoadingRoute />

  return (
    <Grid cols={0}>
      <GridHeader
        onBack={handleBack}
        title={t(`agent:update.${agent.type}.title`)}
        description={t(`agent:update.${agent.type}.description`)}
      />
      <AgentEditor
        key={agent.id}
        agent={agent}
        settings={settings}
        className="bg-white p-6"
        orchestration={orchestration}
      />
    </Grid>
  )
}

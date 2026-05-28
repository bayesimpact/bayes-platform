import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { selectAgentSubAgentsData } from "@/studio/features/agent-sub-agents/agent-sub-agents.selectors"
import { agentSubAgentsActions } from "@/studio/features/agent-sub-agents/agent-sub-agents.slice"
import { AgentEditor } from "@/studio/features/agents/components/AgentEditor"

export function AgentEditorRoute() {
  const agent = useAppSelector(selectCurrentAgentData)
  const project = useAppSelector(selectCurrentProjectData)
  const subAgents = useAppSelector(selectAgentSubAgentsData)
  const hasOrchestration =
    ADS.isFulfilled(agent) &&
    agent.value.type === "conversation" &&
    ADS.isFulfilled(project) &&
    project.value.featureFlags.includes("agent-orchestration")

  useMount({ actions: agentSubAgentsActions, condition: hasOrchestration })

  if (hasOrchestration) {
    return (
      <AsyncRoute data={[agent, subAgents]}>
        <WithData />
      </AsyncRoute>
    )
  }

  return (
    <AsyncRoute data={[agent]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const agent = useValue(selectCurrentAgentData)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()
  const handleBack = () => navigate(agentRoute)

  return (
    <Grid cols={0} total={0}>
      <GridHeader
        onBack={handleBack}
        title={t(`agent:update.${agent.type}.title`)}
        description={t(`agent:update.${agent.type}.description`)}
      />
      <AgentEditor key={agent.id} agent={agent} className="bg-white p-6" />
    </Grid>
  )
}

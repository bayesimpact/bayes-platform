import {
  selectAgentSettingsDataByAgentId,
  selectAvailableModelsData,
} from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { agentSettingsActions } from "@/common/features/agents/agent-settings/agent-settings.slice"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { DeprecatedModelBanner } from "@/common/features/agents/components/DeprecatedModelBanner"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"

export function StudioAgentRoute({ children }: { children: React.ReactNode }) {
  const agent = useValue(selectCurrentAgentData)

  useMount({
    actions: agentSettingsActions,
    refreshOn: [agent.id],
  })

  const agentSettings = useAppSelector(
    selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true }),
  )
  const agentModels = useAppSelector(selectAvailableModelsData)

  return (
    <AsyncRoute data={[agentSettings, agentModels]}>
      <WithData agentId={agent.id}>{children}</WithData>
    </AsyncRoute>
  )
}

function WithData({ children, agentId }: { children: React.ReactNode; agentId: string }) {
  const agentSettings = useValue(selectAgentSettingsDataByAgentId({ agentId, includeDraft: true }))
  return (
    <>
      <div className="px-6 pt-4 empty:hidden bg-white">
        <DeprecatedModelBanner model={agentSettings.model} />
      </div>
      {children}
    </>
  )
}

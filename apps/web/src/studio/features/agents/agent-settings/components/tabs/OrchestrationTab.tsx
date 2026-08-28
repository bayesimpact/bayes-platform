import { Form } from "@caseai-connect/ui/shad/form"
import { Controller, useForm } from "react-hook-form"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAppDispatch } from "@/common/store/hooks"
import type { AgentSubAgent } from "@/studio/features/agent-sub-agents/agent-sub-agents.models"
import { agentSubAgentsActions } from "@/studio/features/agent-sub-agents/agent-sub-agents.slice"
import { useReportDirty } from "../agent-tab-form.shared"
import { type AgentSubAgentFormValue, SubAgentsTab } from "./SubAgentsTab"
import { TabSaveButton } from "./TabSaveButton"

function toSubAgentFormValue(subAgent: AgentSubAgent): AgentSubAgentFormValue {
  return {
    id: subAgent.id,
    agentId: subAgent.childAgentId,
    toolName: subAgent.toolName,
    description: subAgent.description,
    enabled: subAgent.enabled,
    mode: subAgent.mode,
    forceConclusionEnabled: subAgent.forceConclusionEnabled,
  }
}

export function OrchestrationTab({
  agent,
  availableAgents,
  subAgents,
  onDirtyChange,
}: {
  agent: Agent
  availableAgents: Agent[]
  subAgents: AgentSubAgent[]
  onDirtyChange: (dirty: boolean) => void
}) {
  const dispatch = useAppDispatch()

  const form = useForm<{ subAgents: AgentSubAgentFormValue[] }>({
    defaultValues: { subAgents: subAgents.map(toSubAgentFormValue) },
  })
  useReportDirty(form.formState.isDirty, onDirtyChange)

  const handleSubmit = form.handleSubmit(async (data) => {
    await dispatch(
      agentSubAgentsActions.updateAll({
        subAgents: data.subAgents.map((subAgent) => ({
          childAgentId: subAgent.agentId,
          toolName: subAgent.toolName,
          description: subAgent.description,
          enabled: subAgent.enabled,
          mode: subAgent.mode,
          forceConclusionEnabled: subAgent.forceConclusionEnabled,
        })),
      }),
    ).unwrap()
    form.reset(data)
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Controller
          control={form.control}
          name="subAgents"
          render={({ field }) => (
            <SubAgentsTab
              parentAgentId={agent.id}
              agents={availableAgents}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <TabSaveButton
          isSubmitting={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
          onCancel={() => form.reset()}
        />
      </form>
    </Form>
  )
}

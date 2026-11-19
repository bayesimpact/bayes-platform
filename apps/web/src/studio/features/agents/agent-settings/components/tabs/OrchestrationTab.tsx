import { Form } from "@caseai-connect/ui/shad/form"
import { Controller, useForm } from "react-hook-form"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAppDispatch } from "@/common/store/hooks"
import type { AgentSubAgent } from "@/studio/features/agent-sub-agents/agent-sub-agents.models"
import { agentSubAgentsActions } from "@/studio/features/agent-sub-agents/agent-sub-agents.slice"
import { useReportDirty } from "../agent-tab-form.shared"
import { LiveSettingsSection } from "../LiveSettingsSection"
import { type AgentSubAgentFormValue, SubAgentsTab } from "./SubAgentsTab"

const FORM_ID = "agent-orchestration-form"

function toSubAgentFormValue(subAgent: AgentSubAgent): AgentSubAgentFormValue {
  return {
    id: subAgent.id,
    agentId: subAgent.childAgentId,
    toolName: subAgent.toolName,
    description: subAgent.description,
    enabled: subAgent.enabled,
    mode: subAgent.mode,
  }
}

/** The agent's sub-agents. They are not part of the draft: a save applies them at once. */
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
    try {
      await dispatch(
        agentSubAgentsActions.updateAll({
          subAgents: data.subAgents.map((subAgent) => ({
            childAgentId: subAgent.agentId,
            toolName: subAgent.toolName,
            description: subAgent.description,
            enabled: subAgent.enabled,
            mode: subAgent.mode,
          })),
        }),
      ).unwrap()
    } catch {
      // A refused save keeps the form as the user left it, so they can fix it and save again.
      return
    }
    form.reset(data)
  })

  return (
    <LiveSettingsSection
      formId={FORM_ID}
      isDirty={form.formState.isDirty}
      isSubmitting={form.formState.isSubmitting}
      onReset={() => form.reset()}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
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
        </form>
      </Form>
    </LiveSettingsSection>
  )
}

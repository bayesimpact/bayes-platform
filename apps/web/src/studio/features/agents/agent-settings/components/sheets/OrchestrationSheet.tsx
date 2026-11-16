import { Form } from "@caseai-connect/ui/shad/form"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAppDispatch } from "@/common/store/hooks"
import type { AgentSubAgent } from "@/studio/features/agent-sub-agents/agent-sub-agents.models"
import { agentSubAgentsActions } from "@/studio/features/agent-sub-agents/agent-sub-agents.slice"
import { useReportDirty } from "../agent-tab-form.shared"
import { type AgentSubAgentFormValue, SubAgentsTab } from "../tabs/SubAgentsTab"
import { AgentEditorSheet } from "./AgentEditorSheet"

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
export function OrchestrationSheet({
  agent,
  availableAgents,
  subAgents,
  onDirtyChange,
  onClose,
}: {
  agent: Agent
  availableAgents: Agent[]
  subAgents: AgentSubAgent[]
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
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
        })),
      }),
    ).unwrap()
    form.reset(data)
  })

  return (
    <AgentEditorSheet
      title={t("agentSettings:tabs.orchestration")}
      formId={FORM_ID}
      isDirty={form.formState.isDirty}
      isSubmitting={form.formState.isSubmitting}
      onClose={onClose}
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
    </AgentEditorSheet>
  )
}

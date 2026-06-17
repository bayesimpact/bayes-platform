import { ScrollArea } from "@caseai-connect/ui/shad/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@caseai-connect/ui/shad/sheet"
import { useTranslation } from "react-i18next"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAppDispatch } from "@/common/store/hooks"
import type { AgentSubAgent } from "@/studio/features/agent-sub-agents/agent-sub-agents.models"
import { agentSubAgentsActions } from "@/studio/features/agent-sub-agents/agent-sub-agents.slice"
import { updateAgent } from "../agents.thunks"
import type { AgentSubAgentFormValue } from "./AgentSubAgentsTab"
import type { AgentFormData } from "./agent-form.shared"
import { BaseAgentForm } from "./BaseAgentForm"

export type AgentEditorOrchestration = {
  agents: Agent[]
  subAgents: AgentSubAgent[]
}

export function AgentEditorWithoutTrigger({
  agent,
  onClose,
}: {
  agent: Agent | null
  onClose: () => void
}) {
  const handleSuccess = () => {
    onClose()
  }

  if (!agent) return null
  return (
    <Sheet modal open={!!agent} onOpenChange={(open: boolean) => !open && onClose()}>
      <Content agent={agent} onSuccess={handleSuccess} />
    </Sheet>
  )
}

function Content({ agent, onSuccess }: { agent: Agent; onSuccess: () => void }) {
  const { t } = useTranslation("agent", { keyPrefix: "update" })
  const sheetTitle = t(`${agent.type}.title`)
  const sheetDescription = t(`${agent.type}.description`)

  return (
    <SheetContent side="bottom" className="h-dvh">
      <ScrollArea className="h-full">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <UpdateForm agent={agent} onSuccess={onSuccess} />
        </div>
      </ScrollArea>
    </SheetContent>
  )
}

export function AgentEditor({
  agent,
  className,
  orchestration,
}: {
  agent: Agent
  className?: string
  orchestration?: AgentEditorOrchestration
}) {
  return (
    <div className={className}>
      <UpdateForm agent={agent} orchestration={orchestration} />
    </div>
  )
}

function UpdateForm({
  agent,
  onSuccess,
  orchestration,
}: {
  agent: Agent
  onSuccess?: () => void
  orchestration?: AgentEditorOrchestration
}) {
  const dispatch = useAppDispatch()

  const handleSubmit = (fields: AgentFormData) => {
    if (!("documentTagIds" in fields)) {
      throw new Error("Missing documentTagIds in fields")
    }

    const originalTagIds = agent.documentTagIds
    dispatch(
      updateAgent({
        agentId: agent.id,
        fields: {
          name: fields.name,
          defaultPrompt: fields.defaultPrompt,
          greetingMessage: fields.greetingMessage,
          documentsRagMode: fields.documentsRagMode,
          model: fields.model,
          temperature: fields.temperature,
          locale: fields.locale,
          outputJsonSchema: fields.outputJsonSchema,
          documentTagIds: fields.documentTagIds,
          tagsToAdd: fields.documentTagIds.filter((id) => !originalTagIds.includes(id)),
          tagsToRemove: originalTagIds.filter((id) => !fields.documentTagIds.includes(id)),
          projectAgentSessionCategoryIds: fields.projectAgentSessionCategoryIds,
          resourceLibraryIds: fields.resourceLibraryIds,
        },
      }),
    )
    onSuccess?.()
  }

  const handleSubAgentsSubmit = (values: AgentSubAgentFormValue[]) => {
    dispatch(
      agentSubAgentsActions.updateAll({
        subAgents: values.map((subAgent) => ({
          childAgentId: subAgent.agentId,
          toolName: subAgent.toolName,
          description: subAgent.description,
          enabled: subAgent.enabled,
        })),
      }),
    )
  }

  return (
    <BaseAgentForm
      agentType={agent.type}
      editableAgent={agent}
      onSubmit={handleSubmit}
      availableAgents={orchestration?.agents}
      subAgents={orchestration?.subAgents.map(toSubAgentFormValue)}
      onSubAgentsSubmit={orchestration ? handleSubAgentsSubmit : undefined}
    />
  )
}

function toSubAgentFormValue(subAgent: AgentSubAgent): AgentSubAgentFormValue {
  return {
    id: subAgent.id,
    agentId: subAgent.childAgentId,
    toolName: subAgent.toolName,
    description: subAgent.description,
    enabled: subAgent.enabled,
  }
}

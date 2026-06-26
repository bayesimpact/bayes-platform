import { Item, ItemHeader, ItemTitle } from "@caseai-connect/ui/shad/item"
import { useTranslation } from "react-i18next"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import type { Agent } from "@/common/features/agents/agents.models"
import { assert } from "@/common/utils/assert"
import { FormResultFields } from "./FormResultFields"

export function FormResult({
  agent,
  agentSession,
}: {
  agent: Agent
  agentSession: FormAgentSession
}) {
  const { t } = useTranslation()
  assert(agent.type === "form", `FormResult: Unsupported agent type: ${agent.type}`)
  assert(agent.outputJsonSchema, "FormResult: Missing outputJsonSchema for form agent")

  return (
    <Item className="absolute inset-0 flex-col items-stretch flex-nowrap gap-0 p-0">
      <ItemHeader className="basis-auto shrink-0 px-4 pt-4 pb-2">
        <ItemTitle className="text-lg">{t("formAgentSession:props.result")}</ItemTitle>
      </ItemHeader>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <FormResultFields outputJsonSchema={agent.outputJsonSchema} result={agentSession.result} />
      </div>
    </Item>
  )
}

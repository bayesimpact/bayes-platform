import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { FormResult } from "@/common/features/agents/agent-sessions/form/components/FormResult"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import type { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { AgentSessionMessages } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessages"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { buildSince } from "@/common/utils/build-date"
import { AgentSessionActions } from "@/studio/features/agents/components/AgentSessionActions"

type AgentSession = ConversationAgentSession | FormAgentSession
export function DeskAgentSessionRoute({
  agent,
  agentSession,
  messages,
}: {
  agent: Agent
  agentSession: AgentSession
  messages: AgentSessionMessage[]
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const getAgentRoute = useGetAgentRoute()

  const Icon = getAgentIcon(agent.type)

  const date = buildSince(agentSession.updatedAt)

  const handleBack = () => navigate(getAgentRoute())

  return (
    <div className="flex flex-col h-full">
      <GridHeader
        onBack={handleBack}
        title={date}
        description={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="capitalize-first">{agent.name}</span> •
            <span className="capitalize-first">{t(`agent:create.typeDialog.${agent.type}`)}</span>
            <Icon />
          </div>
        }
        action={<AgentSessionActions agent={agent} agentSession={agentSession} />}
      />

      <div className="flex-1">
        <AgentSessionMessages
          session={agentSession}
          messages={messages}
          rightSlot={
            agent.type === "form" ? (
              <FormResult agent={agent} agentSession={agentSession} />
            ) : undefined
          }
        />
      </div>
    </div>
  )
}

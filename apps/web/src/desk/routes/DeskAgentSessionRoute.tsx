import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { selectCurrentMessagesData } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { AgentSessionMessages } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessages"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { buildSince } from "@/common/utils/build-date"
import { AgentSessionActions } from "@/studio/features/agents/components/AgentSessionActions"

type AgentSession = ConversationAgentSession

export function DeskAgentSessionRoute({ agentSession }: { agentSession: AgentSession }) {
  const agent = useValue(selectCurrentAgentData)
  const messages = useValue(selectCurrentMessagesData)

  const { t } = useTranslation()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()

  const Icon = getAgentIcon(agent.type)

  const date = buildSince(agentSession.updatedAt)

  const handleBack = () => navigate(agentRoute)

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
          formResultSchema={agent.fillFormEnabled ? agent.outputJsonSchema : undefined}
        />
      </div>
    </div>
  )
}

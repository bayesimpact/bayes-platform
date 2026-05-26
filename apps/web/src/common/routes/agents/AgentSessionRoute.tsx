import type { ComponentType } from "react"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { selectCurrentConversationAgentSessionData } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import { selectCurrentAgentSessionId } from "@/common/features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.selectors"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import { selectCurrentFormAgentSessionData } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import { selectCurrentMessagesData } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../AsyncRoute"
import { ErrorRoute } from "../ErrorRoute"
import { LoadingRoute } from "../LoadingRoute"

type AgentSession = ConversationAgentSession | FormAgentSession

type Props = {
  Component: ComponentType<{ agentSession: AgentSession }>
}

export function AgentSessionRoute({ Component }: Props) {
  const agent = useAppSelector(selectCurrentAgentData)
  const messages = useAppSelector(selectCurrentMessagesData)

  return (
    <AsyncRoute data={[agent, messages]}>
      <AgentSessionWithData Component={Component} />
    </AsyncRoute>
  )
}

function AgentSessionWithData({ Component }: Props) {
  const agent = useValue(selectCurrentAgentData)

  switch (agent.type) {
    case "conversation":
      return <ConversationAgentSessionRoute Component={Component} />
    case "form":
      return <FormAgentSessionRoute Component={Component} />
    default:
      return <ErrorRoute error={"Unknown agent type"} />
  }
}

function ConversationAgentSessionRoute({ Component }: Props) {
  const agentSessionId = useAppSelector(selectCurrentAgentSessionId)
  const agentSession = useAppSelector(selectCurrentConversationAgentSessionData)

  if (!agentSessionId) return <LoadingRoute />
  return (
    <AsyncRoute data={[agentSession]}>
      <ConversationAgentSessionWithData Component={Component} />
    </AsyncRoute>
  )
}

function ConversationAgentSessionWithData({ Component }: Props) {
  const agentSession = useValue(selectCurrentConversationAgentSessionData)
  return <Component agentSession={agentSession} />
}

function FormAgentSessionRoute({ Component }: Props) {
  const agentSessionId = useAppSelector(selectCurrentAgentSessionId)
  const agentSession = useAppSelector(selectCurrentFormAgentSessionData)

  if (!agentSessionId) return <LoadingRoute />
  return (
    <AsyncRoute data={[agentSession]}>
      <FormAgentSessionWithData Component={Component} />
    </AsyncRoute>
  )
}

function FormAgentSessionWithData({ Component }: Props) {
  const agentSession = useValue(selectCurrentFormAgentSessionData)
  return <Component agentSession={agentSession} />
}

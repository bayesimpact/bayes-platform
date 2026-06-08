import type { ComponentType } from "react"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { selectCurrentConversationAgentSessionData } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import { conversationAgentSessionsActions } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.slice"
import { selectCurrentAgentSessionId } from "@/common/features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.selectors"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import { selectCurrentFormAgentSessionData } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import { formAgentSessionsActions } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.slice"
import { selectCurrentMessagesData } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useMount } from "@/common/hooks/use-mount"
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
  const agent = useValue(selectCurrentAgentData)
  switch (agent.type) {
    case "conversation":
      return <ConversationSession Component={Component} />
    case "form":
      return <FormSession Component={Component} />
    case "extraction":
      return <div>TODO: implement extraction agent session route</div>
    default:
      return <ErrorRoute error={"Unknown agent type"} />
  }
}

function ConversationSession({ Component }: Props) {
  const agentSessionId = useAppSelector(selectCurrentAgentSessionId)
  const agentSession = useAppSelector(selectCurrentConversationAgentSessionData)
  const messages = useAppSelector(selectCurrentMessagesData)

  useMount({
    actions: {
      mount: conversationAgentSessionsActions.sessionMount,
      unmount: conversationAgentSessionsActions.sessionUnmount,
    },
    condition: !!agentSessionId,
    refreshOn: [agentSessionId], // Refresh when agentSessionId changes
  })

  if (!agentSessionId) return <LoadingRoute />
  return (
    <AsyncRoute data={[agentSession, messages]}>
      <ConversationSessionWithData Component={Component} />
    </AsyncRoute>
  )
}

function ConversationSessionWithData({ Component }: Props) {
  const agentSession = useValue(selectCurrentConversationAgentSessionData)
  return <Component agentSession={agentSession} />
}

function FormSession({ Component }: Props) {
  const agentSessionId = useAppSelector(selectCurrentAgentSessionId)
  const agentSession = useAppSelector(selectCurrentFormAgentSessionData)
  const messages = useAppSelector(selectCurrentMessagesData)

  useMount({
    actions: {
      mount: formAgentSessionsActions.sessionMount,
      unmount: formAgentSessionsActions.sessionUnmount,
    },
    condition: !!agentSessionId,
    refreshOn: [agentSessionId], // Refresh when agentSessionId changes
  })

  if (!agentSessionId) return <LoadingRoute />
  return (
    <AsyncRoute data={[agentSession, messages]}>
      <FormSessionWithData Component={Component} />
    </AsyncRoute>
  )
}

function FormSessionWithData({ Component }: Props) {
  const agentSession = useValue(selectCurrentFormAgentSessionData)
  return <Component agentSession={agentSession} />
}

import { Button } from "@caseai-connect/ui/shad/button"
import { Trash2Icon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { GridItem } from "@/common/components/grid/Grid"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import type { ExtractionAgentSession } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.models"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { useAppDispatch } from "@/common/store/hooks"
import { buildDate, buildSince } from "@/common/utils/build-date"
import { deleteAgentSession } from "../agent-sessions/shared/base-agent-session/base-agent-sessions.thunks"
import type { Agent } from "../agents.models"

type AgentSession = ConversationAgentSession | FormAgentSession | ExtractionAgentSession

export function AgentSessionItem({
  agentSession,
  organizationId,
  agentId,
  projectId,
  className,
  index,
  agentType,
}: {
  index: number
  className?: string
  agentSession: AgentSession
  organizationId: string
  agentId: string
  projectId: string
  agentType: Agent["type"]
}) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { build } = useRoutesBuilder()
  const handleClick = () => {
    const path = build.agentSessionRoute({
      organizationId,
      projectId,
      agentId,
      agentSessionId: agentSession.id,
    })
    navigate(path)
  }

  const title = buildSince(agentSession.updatedAt)
  const badge = buildDate(agentSession.updatedAt)

  const handleDelete = () => {
    dispatch(
      deleteAgentSession({
        agentType,
        agentId,
        agentSessionId: agentSession.id,
      }),
    )
  }
  return (
    <GridItem
      index={index}
      className={className}
      badge={badge}
      onClick={handleClick}
      title={title}
      // FIXME: show last message
      description=""
      footer={
        <div className="justify-end flex pb-4">
          <Button variant="outline" size="icon-sm" onClick={handleDelete}>
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      }
    />
  )
}
